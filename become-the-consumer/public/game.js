// DOM Elements
const scoreEl = document.getElementById('score');
const spawnRateEl = document.getElementById('spawn-rate');
const queueCountEl = document.getElementById('queue-count');
const streakEl = document.getElementById('streak');
const multiplierEl = document.getElementById('multiplier');
const queuesEl = document.getElementById('queues');
const cliOutput = document.getElementById('cli-output');
const cliInput = document.getElementById('cli-input');

// WebSocket connection
let ws = null;
let gameState = {
  score: 0,
  spawnRate: 5000,
  queues: {},
  streak: 0,
  multiplier: 1
};

// Connect to WebSocket
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    addCliLine('Connected to server', 'success');
  };

  ws.onclose = () => {
    addCliLine('Disconnected from server. Reconnecting...', 'error');
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    addCliLine('Connection error', 'error');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };
}

// Handle messages from server
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'state':
      gameState = {
        score: msg.score,
        spawnRate: msg.spawnRate,
        queues: msg.queues,
        streak: msg.streak || 0,
        multiplier: msg.multiplier || 1
      };
      updateUI();
      break;

    case 'queue_added':
      addCliLine(`New queue appeared: ${msg.name}`, 'info');
      break;

    case 'queue_locked':
      addCliLine(`QUEUE LOCKED: ${msg.name}! Use /purge ${msg.name} within 10s!`, 'error');
      break;

    case 'game_over':
      addCliLine(`GAME OVER: ${msg.reason}`, 'error');
      addCliLine('Use /reset to play again.', 'info');
      showGameOverOverlay(msg.reason);
      break;

    case 'message_spawned':
      // State update will handle the visual
      break;

    case 'difficulty_increased':
      addCliLine(`Spawn rate increased! Now: ${(msg.spawnRate / 1000).toFixed(1)}s`, 'info');
      break;

    case 'fanout_start':
      showFanoutAlert();
      break;

    case 'fanout_end':
      hideFanoutAlert();
      break;

    case 'command_result':
      handleCommandResult(msg);
      break;
  }
}

// Show fanout mode alert
let fanoutAlertEl = null;
function showFanoutAlert() {
  if (fanoutAlertEl) return;

  fanoutAlertEl = document.createElement('div');
  fanoutAlertEl.className = 'fanout-alert';
  fanoutAlertEl.textContent = 'FANOUT MODE ENGAGED';
  document.querySelector('.game-area').prepend(fanoutAlertEl);

  addCliLine('FANOUT MODE ENGAGED! Messages sent to ALL queues!', 'error');
}

// Hide fanout mode alert
function hideFanoutAlert() {
  if (fanoutAlertEl) {
    fanoutAlertEl.remove();
    fanoutAlertEl = null;
  }
  addCliLine('Fanout mode ended.', 'info');
}

// Game over overlay
let gameOverEl = null;
function showGameOverOverlay(reason) {
  if (gameOverEl) return;

  gameOverEl = document.createElement('div');
  gameOverEl.className = 'game-over-overlay';
  gameOverEl.innerHTML = `
    <div class="game-over-text">GAME OVER</div>
    <div class="game-over-reason">${reason}</div>
    <div class="game-over-hint">Type /reset to play again</div>
  `;
  document.querySelector('.game-area').appendChild(gameOverEl);
}

function hideGameOverOverlay() {
  if (gameOverEl) {
    gameOverEl.remove();
    gameOverEl = null;
  }
}

// Handle command result from server
function handleCommandResult(result) {
  if (!result.success) {
    addCliLine(result.error, 'error');
    return;
  }

  if (result.command === 'reset') {
    addCliLine('Game reset! All queues cleared.', 'info');
    hideGameOverOverlay();
    return;
  }

  if (result.command === 'purge') {
    addCliLine(`Queue purged! ${result.scoreChange} points`, 'error');
    showScorePopup(result.scoreChange);
    return;
  }

  const action = result.command === 'ack' ? 'Acknowledged' : 'Rejected';
  const msgType = result.messageType === 'good' ? 'good' : 'bad';

  if (result.correct) {
    const multiplierText = result.multiplier > 1 ? ` (${result.multiplier}x)` : '';
    addCliLine(`${action} ${msgType} message. +${result.scoreChange} points!${multiplierText} Streak: ${result.streak}`, 'success');
  } else {
    addCliLine(`${action} ${msgType} message. Wrong action! -5 points. Streak reset!`, 'error');
  }

  showScorePopup(result.scoreChange);
}

// Update the UI based on game state
function updateUI() {
  // Update stats
  scoreEl.textContent = gameState.score;
  spawnRateEl.textContent = (gameState.spawnRate / 1000).toFixed(1) + 's';
  queueCountEl.textContent = Object.keys(gameState.queues).length;
  streakEl.textContent = gameState.streak;
  multiplierEl.textContent = gameState.multiplier + 'x';

  // Update queues
  renderQueues();
}

// Render queue visuals
function renderQueues() {
  const queueNames = Object.keys(gameState.queues);

  // Remove queues that no longer exist
  const existingQueues = queuesEl.querySelectorAll('.queue');
  existingQueues.forEach(qEl => {
    const name = qEl.dataset.name;
    if (!gameState.queues[name]) {
      qEl.classList.add('dropping');
      setTimeout(() => qEl.remove(), 500);
    }
  });

  // Add/update queues
  queueNames.forEach(name => {
    let queueEl = queuesEl.querySelector(`.queue[data-name="${name}"]`);
    const queueData = gameState.queues[name];

    if (!queueEl) {
      queueEl = document.createElement('div');
      queueEl.className = 'queue';
      queueEl.dataset.name = name;
      queueEl.innerHTML = `
        <div class="queue-countdown"></div>
        <div class="queue-stack"></div>
        <div class="queue-name">${name}</div>
      `;
      queuesEl.appendChild(queueEl);
    }

    const stackEl = queueEl.querySelector('.queue-stack');
    const countdownEl = queueEl.querySelector('.queue-countdown');
    const messages = queueData.messages;

    // Handle locked state
    if (queueData.locked) {
      queueEl.classList.add('locked');
      // Calculate remaining time
      const elapsed = Date.now() - queueData.lockedAt;
      const remaining = Math.max(0, Math.ceil((10000 - elapsed) / 1000));
      countdownEl.textContent = remaining + 's';
      countdownEl.style.display = 'block';
    } else {
      queueEl.classList.remove('locked');
      countdownEl.style.display = 'none';
    }

    // Update messages
    stackEl.innerHTML = '';
    messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `message ${msg.type}`;
      stackEl.appendChild(msgEl);
    });
  });
}

// Add line to CLI output
function addCliLine(text, type = '') {
  const line = document.createElement('div');
  line.className = `cli-line ${type}`;
  line.textContent = text;
  cliOutput.appendChild(line);
  cliOutput.scrollTop = cliOutput.scrollHeight;
}

// Show floating score popup
function showScorePopup(change) {
  const popup = document.createElement('div');
  popup.className = `score-popup ${change >= 0 ? 'positive' : 'negative'}`;
  popup.textContent = change >= 0 ? `+${change}` : change;

  // Position near score
  const scoreRect = scoreEl.getBoundingClientRect();
  popup.style.left = scoreRect.left + 'px';
  popup.style.top = scoreRect.bottom + 'px';

  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

// Process CLI command
function processCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  addCliLine(`> ${trimmed}`, '');

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case '/help':
      showHelp();
      break;

    case '/ack':
      if (args.length === 0) {
        addCliLine('Usage: /ack <queue-name>', 'error');
      } else {
        ws.send(JSON.stringify({ command: 'ack', queue: args[0] }));
      }
      break;

    case '/reject':
      if (args.length === 0) {
        addCliLine('Usage: /reject <queue-name>', 'error');
      } else {
        ws.send(JSON.stringify({ command: 'reject', queue: args[0] }));
      }
      break;

    case '/status':
      showStatus();
      break;

    case '/reset':
      ws.send(JSON.stringify({ command: 'reset' }));
      break;

    case '/purge':
      if (args.length === 0) {
        addCliLine('Usage: /purge <queue-name>', 'error');
      } else {
        ws.send(JSON.stringify({ command: 'purge', queue: args[0] }));
      }
      break;

    default:
      addCliLine(`Unknown command: ${cmd}. Type /help for commands.`, 'error');
  }
}

// Show help
function showHelp() {
  addCliLine('--- Available Commands ---', 'info');
  addCliLine('/help            - Show this help message', '');
  addCliLine('/ack <queue>     - Acknowledge top message (use for good messages)', '');
  addCliLine('/reject <queue>  - Reject top message (use for bad messages)', '');
  addCliLine('/purge <queue>   - Purge a locked queue (-50 points)', '');
  addCliLine('/status          - Show current game status', '');
  addCliLine('/reset           - Reset game and clear all queues', '');
  addCliLine('', '');
  addCliLine('Tip: Ack green messages, reject red ones!', 'info');
}

// Show status
function showStatus() {
  addCliLine('--- Game Status ---', 'info');
  addCliLine(`Score: ${gameState.score}`, '');
  addCliLine(`Streak: ${gameState.streak} (${gameState.multiplier}x multiplier)`, '');
  addCliLine(`Spawn Rate: ${(gameState.spawnRate / 1000).toFixed(1)}s`, '');
  addCliLine(`Active Queues: ${Object.keys(gameState.queues).length}`, '');

  Object.keys(gameState.queues).forEach(name => {
    const queueData = gameState.queues[name];
    const msgs = queueData.messages;
    const good = msgs.filter(m => m.type === 'good').length;
    const bad = msgs.filter(m => m.type === 'bad').length;
    const lockedText = queueData.locked ? ' [LOCKED]' : '';
    addCliLine(`  ${name}: ${msgs.length}/10 messages (${good} good, ${bad} bad)${lockedText}`, '');
  });
}

// Command history
const commandHistory = [];
const MAX_HISTORY = 10;
let historyIndex = -1;

// Event listeners
cliInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = cliInput.value.trim();
    if (cmd) {
      // Add to history
      commandHistory.unshift(cmd);
      if (commandHistory.length > MAX_HISTORY) {
        commandHistory.pop();
      }
      historyIndex = -1;
    }
    processCommand(cliInput.value);
    cliInput.value = '';
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
      historyIndex++;
      cliInput.value = commandHistory[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      cliInput.value = commandHistory[historyIndex];
    } else if (historyIndex === 0) {
      historyIndex = -1;
      cliInput.value = '';
    }
  }
});

// Keep input focused
document.addEventListener('click', () => {
  cliInput.focus();
});

// Start connection
connect();
