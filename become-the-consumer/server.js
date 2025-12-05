const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { AMQPClient } = require('@cloudamqp/amqp-client');

// Configuration
const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672';
const PORT = process.env.PORT || 3001;

// Game state
const gameState = {
  score: 0,
  spawnRate: 3000, // ms
  queues: new Map(), // queueName -> { messages: [], channel, consumer }
  totalMessages: 0,
  gameStartTime: null,
  lastSpawnRateDecrease: null
};

// Queue name pool (CloudAMQP animal theme)
const ANIMAL_NAMES = [
  'lemming', 'lemur', 'orca', 'panda', 'rhino',
  'tiger', 'whale', 'hippo', 'bunny', 'pika',
  'koala', 'falcon', 'otter', 'fox', 'lynx'
];
let queueCounter = 0;

// AMQP connection
let amqpConnection = null;
let amqpChannel = null;

// WebSocket clients
const wsClients = new Set();

// Generate next queue name
function getNextQueueName() {
  const animal = ANIMAL_NAMES[queueCounter % ANIMAL_NAMES.length];
  queueCounter++;
  return `${animal}-${queueCounter}`;
}

// Broadcast to all WebSocket clients
function broadcast(message) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// Get current game state for clients
function getStateForClient() {
  const queuesData = {};
  gameState.queues.forEach((data, name) => {
    queuesData[name] = data.messages;
  });
  return {
    type: 'state',
    score: gameState.score,
    spawnRate: gameState.spawnRate,
    queues: queuesData
  };
}

// Create a new queue
async function createQueue(name) {
  if (!amqpChannel) return;

  await amqpChannel.queue(name, { durable: false, autoDelete: true });

  gameState.queues.set(name, {
    messages: [],
    consumer: null
  });

  broadcast({ type: 'queue_added', name });
  broadcast(getStateForClient());
}

// Handle queue overflow
async function handleOverflow(name) {
  const queueData = gameState.queues.get(name);
  if (!queueData) return;

  // Overflow penalty
  const scoreChange = -100;
  gameState.score += scoreChange;

  // Purge AMQP queue
  try {
    const q = await amqpChannel.queue(name, { passive: true });
    await q.purge();
  } catch (e) {
    // Queue might not exist
  }

  // Clear local messages
  queueData.messages = [];

  broadcast({
    type: 'queue_overflow',
    name,
    scoreChange
  });
  broadcast(getStateForClient());
}

// Spawn a message to a random queue
async function spawnMessage() {
  if (gameState.queues.size === 0) return;

  const queueNames = Array.from(gameState.queues.keys());
  const targetQueue = queueNames[Math.floor(Math.random() * queueNames.length)];
  const queueData = gameState.queues.get(targetQueue);

  if (!queueData) return;

  const messageType = Math.random() > 0.5 ? 'good' : 'bad';
  const message = {
    id: Date.now() + Math.random(),
    type: messageType
  };

  // Publish to AMQP
  await amqpChannel.basicPublish('', targetQueue, JSON.stringify(message));

  // Add to local state
  queueData.messages.push(message);
  gameState.totalMessages++;

  broadcast({ type: 'message_spawned', queue: targetQueue, message });

  // Check for overflow
  if (queueData.messages.length >= 10) {
    await handleOverflow(targetQueue);
  } else {
    broadcast(getStateForClient());
  }
}

// Handle player ack command
async function handleAck(queueName) {
  const queueData = gameState.queues.get(queueName);

  if (!queueData) {
    return { success: false, error: `Queue "${queueName}" not found` };
  }

  if (queueData.messages.length === 0) {
    return { success: false, error: `Queue "${queueName}" is empty` };
  }

  const message = queueData.messages.shift();
  const correct = message.type === 'good';

  if (correct) {
    gameState.score += 10;
  } else {
    gameState.score -= 5; // Penalty for wrong action
  }

  // Consume from AMQP queue
  try {
    const q = await amqpChannel.queue(queueName, { passive: true });
    const msg = await q.get({ noAck: true });
  } catch (e) {
    // Message might already be gone
  }

  broadcast(getStateForClient());

  return {
    success: true,
    correct,
    messageType: message.type,
    scoreChange: correct ? 10 : -5
  };
}

// Handle player reject command
async function handleReject(queueName) {
  const queueData = gameState.queues.get(queueName);

  if (!queueData) {
    return { success: false, error: `Queue "${queueName}" not found` };
  }

  if (queueData.messages.length === 0) {
    return { success: false, error: `Queue "${queueName}" is empty` };
  }

  const message = queueData.messages.shift();
  const correct = message.type === 'bad';

  if (correct) {
    gameState.score += 10;
  } else {
    gameState.score -= 5; // Penalty for wrong action
  }

  // Consume from AMQP queue
  try {
    const q = await amqpChannel.queue(queueName, { passive: true });
    const msg = await q.get({ noAck: true });
  } catch (e) {
    // Message might already be gone
  }

  broadcast(getStateForClient());

  return {
    success: true,
    correct,
    messageType: message.type,
    scoreChange: correct ? 10 : -5
  };
}

// Game loop - spawn messages
let spawnInterval = null;
function startSpawnLoop() {
  if (spawnInterval) clearInterval(spawnInterval);

  spawnInterval = setInterval(() => {
    spawnMessage();
  }, gameState.spawnRate);
}

// Difficulty increase loop - decrease spawn rate every 20s
let difficultyInterval = null;
function startDifficultyLoop() {
  difficultyInterval = setInterval(() => {
    if (gameState.spawnRate > 500) {
      gameState.spawnRate = Math.max(500, gameState.spawnRate - 200);
      startSpawnLoop(); // Restart with new rate
      broadcast({ type: 'difficulty_increased', spawnRate: gameState.spawnRate });
      broadcast(getStateForClient());
    }
  }, 20000);
}

// New queue loop - add queue every 20-30s (max 10 queues)
let newQueueInterval = null;
function startNewQueueLoop() {
  const scheduleNextQueue = () => {
    const delay = 20000 + Math.random() * 10000; // 20-30s
    newQueueInterval = setTimeout(async () => {
      if (gameState.queues.size < 10) {
        const name = getNextQueueName();
        await createQueue(name);
      }
      scheduleNextQueue();
    }, delay);
  };
  scheduleNextQueue();
}

// Clean up all game queues from AMQP
async function cleanupQueues() {
  const queueNames = Array.from(gameState.queues.keys());
  for (const name of queueNames) {
    try {
      await amqpChannel.queueDelete(name);
    } catch (e) {
      // Queue might already be deleted
    }
  }
  gameState.queues.clear();
}

// Initialize game
async function initGame() {
  // Stop existing loops
  if (spawnInterval) clearInterval(spawnInterval);
  if (difficultyInterval) clearInterval(difficultyInterval);
  if (newQueueInterval) clearTimeout(newQueueInterval);

  // Clean up existing queues
  await cleanupQueues();

  // Reset state
  gameState.score = 0;
  gameState.spawnRate = 3000;
  gameState.totalMessages = 0;
  gameState.gameStartTime = Date.now();
  queueCounter = 0;

  // Create initial 2 queues
  await createQueue(getNextQueueName());
  await createQueue(getNextQueueName());

  // Start game loops
  startSpawnLoop();
  startDifficultyLoop();
  startNewQueueLoop();

  broadcast(getStateForClient());
}

// Connect to AMQP
async function connectAMQP() {
  try {
    const client = new AMQPClient(AMQP_URL);
    amqpConnection = await client.connect();
    amqpChannel = await amqpConnection.channel();
    console.log('Connected to LavinMQ');
    return true;
  } catch (error) {
    console.error('Failed to connect to LavinMQ:', error.message);
    return false;
  }
}

// HTTP server for static files
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[extname] || 'text/plain' });
      res.end(content);
    }
  });
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log('Client connected');

  // Send current state
  ws.send(JSON.stringify(getStateForClient()));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.command) {
        case 'ack':
          const ackResult = await handleAck(msg.queue);
          ws.send(JSON.stringify({ type: 'command_result', command: 'ack', ...ackResult }));
          break;

        case 'reject':
          const rejectResult = await handleReject(msg.queue);
          ws.send(JSON.stringify({ type: 'command_result', command: 'reject', ...rejectResult }));
          break;

        case 'status':
          ws.send(JSON.stringify(getStateForClient()));
          break;

        case 'reset':
          await initGame();
          ws.send(JSON.stringify({ type: 'command_result', command: 'reset', success: true }));
          break;
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('Client disconnected');
  });
});

// Start server
async function start() {
  const connected = await connectAMQP();
  if (!connected) {
    console.error('Could not connect to LavinMQ. Make sure it is running.');
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Become the Consumer running at http://localhost:${PORT}`);
  });

  await initGame();
}

start();
