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
  queues: new Map(), // queueName -> { messages: [], locked, lockTimeout }
  totalMessages: 0,
  gameStartTime: null,
  lastSpawnRateDecrease: null,
  fanoutMode: false,
  gameOver: false
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
    queuesData[name] = {
      messages: data.messages,
      locked: data.locked || false,
      lockedAt: data.lockedAt || null
    };
  });
  return {
    type: 'state',
    score: gameState.score,
    spawnRate: gameState.spawnRate,
    queues: queuesData,
    gameOver: gameState.gameOver
  };
}

// Create a new queue
async function createQueue(name) {
  if (!amqpChannel) return;

  await amqpChannel.queue(name, { durable: false, autoDelete: true });

  gameState.queues.set(name, {
    messages: [],
    locked: false,
    lockedAt: null,
    lockTimeout: null
  });

  broadcast({ type: 'queue_added', name });
  broadcast(getStateForClient());
}

// Handle queue lock (when queue reaches 10 messages)
async function handleQueueLock(name) {
  const queueData = gameState.queues.get(name);
  if (!queueData || queueData.locked) return;

  // Lock the queue
  queueData.locked = true;
  queueData.lockedAt = Date.now();

  broadcast({
    type: 'queue_locked',
    name,
    lockedAt: queueData.lockedAt
  });
  broadcast(getStateForClient());

  // Set timeout for game over after 10 seconds
  queueData.lockTimeout = setTimeout(() => {
    if (queueData.locked && !gameState.gameOver) {
      gameState.gameOver = true;
      broadcast({ type: 'game_over', reason: `Queue "${name}" was locked for too long!` });
      broadcast(getStateForClient());
    }
  }, 10000);
}

// Handle purge command
async function handlePurge(queueName) {
  if (gameState.gameOver) {
    return { success: false, error: 'Game over! Use /reset to play again.' };
  }

  const queueData = gameState.queues.get(queueName);

  if (!queueData) {
    return { success: false, error: `Queue "${queueName}" not found` };
  }

  if (!queueData.locked) {
    return { success: false, error: `Queue "${queueName}" is not locked` };
  }

  // Clear the lock timeout
  if (queueData.lockTimeout) {
    clearTimeout(queueData.lockTimeout);
    queueData.lockTimeout = null;
  }

  // Purge penalty
  const scoreChange = -50;
  gameState.score += scoreChange;

  // Purge AMQP queue
  try {
    const q = await amqpChannel.queue(queueName, { passive: true });
    await q.purge();
  } catch (e) {
    // Queue might not exist
  }

  // Clear local messages and unlock
  queueData.messages = [];
  queueData.locked = false;
  queueData.lockedAt = null;

  broadcast(getStateForClient());

  return {
    success: true,
    scoreChange
  };
}

// Spawn a message to a random queue (or all queues in fanout mode)
async function spawnMessage() {
  if (gameState.queues.size === 0 || gameState.gameOver) return;

  const messageType = Math.random() > 0.5 ? 'good' : 'bad';
  const message = {
    id: Date.now() + Math.random(),
    type: messageType
  };

  if (gameState.fanoutMode) {
    // Fanout mode: send to all unlocked queues
    const queueNames = Array.from(gameState.queues.keys());
    for (const queueName of queueNames) {
      const queueData = gameState.queues.get(queueName);
      if (!queueData || queueData.locked) continue;

      const msgCopy = { ...message, id: Date.now() + Math.random() };

      await amqpChannel.basicPublish('', queueName, JSON.stringify(msgCopy));
      queueData.messages.push(msgCopy);
      gameState.totalMessages++;

      if (queueData.messages.length >= 10) {
        await handleQueueLock(queueName);
      }
    }
    broadcast({ type: 'message_spawned_fanout', message });
    broadcast(getStateForClient());
  } else {
    // Normal mode: send to random unlocked queue
    const queueNames = Array.from(gameState.queues.keys()).filter(name => {
      const q = gameState.queues.get(name);
      return q && !q.locked;
    });

    if (queueNames.length === 0) return;

    const targetQueue = queueNames[Math.floor(Math.random() * queueNames.length)];
    const queueData = gameState.queues.get(targetQueue);

    if (!queueData) return;

    await amqpChannel.basicPublish('', targetQueue, JSON.stringify(message));
    queueData.messages.push(message);
    gameState.totalMessages++;

    broadcast({ type: 'message_spawned', queue: targetQueue, message });

    if (queueData.messages.length >= 10) {
      await handleQueueLock(targetQueue);
    } else {
      broadcast(getStateForClient());
    }
  }
}

// Handle player ack command
async function handleAck(queueName) {
  if (gameState.gameOver) {
    return { success: false, error: 'Game over! Use /reset to play again.' };
  }

  const queueData = gameState.queues.get(queueName);

  if (!queueData) {
    return { success: false, error: `Queue "${queueName}" not found` };
  }

  if (queueData.locked) {
    return { success: false, error: `Queue "${queueName}" is locked. Use /purge to unlock.` };
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
  if (gameState.gameOver) {
    return { success: false, error: 'Game over! Use /reset to play again.' };
  }

  const queueData = gameState.queues.get(queueName);

  if (!queueData) {
    return { success: false, error: `Queue "${queueName}" not found` };
  }

  if (queueData.locked) {
    return { success: false, error: `Queue "${queueName}" is locked. Use /purge to unlock.` };
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

// Fanout mode loop - activate every 30s for 5s duration
let fanoutInterval = null;
function startFanoutLoop() {
  fanoutInterval = setInterval(() => {
    // Start fanout mode
    gameState.fanoutMode = true;
    broadcast({ type: 'fanout_start' });

    // End fanout mode after 5 seconds
    setTimeout(() => {
      gameState.fanoutMode = false;
      broadcast({ type: 'fanout_end' });
    }, 5000);
  }, 30000);
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
  if (fanoutInterval) clearInterval(fanoutInterval);

  // Clean up existing queues
  await cleanupQueues();

  // Reset state
  gameState.score = 0;
  gameState.spawnRate = 3000;
  gameState.totalMessages = 0;
  gameState.gameStartTime = Date.now();
  gameState.fanoutMode = false;
  gameState.gameOver = false;
  queueCounter = 0;

  // Create initial 2 queues
  await createQueue(getNextQueueName());
  await createQueue(getNextQueueName());

  // Start game loops
  startSpawnLoop();
  startDifficultyLoop();
  startNewQueueLoop();
  startFanoutLoop();

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

        case 'purge':
          const purgeResult = await handlePurge(msg.queue);
          ws.send(JSON.stringify({ type: 'command_result', command: 'purge', ...purgeResult }));
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
