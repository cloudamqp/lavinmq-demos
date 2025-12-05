# Become the Consumer

A mini-game that teaches message queue concepts using LavinMQ. Manage incoming messages across multiple queues by acknowledging good messages and rejecting bad ones.

## Requirements

- Node.js
- LavinMQ running locally (or accessible via AMQP URL)

## Installation

```bash
npm install
```

## Running the Game

1. Make sure LavinMQ is running (default: `amqp://localhost:5672`)

2. Start the server:
   ```bash
   npm start
   ```

3. Open http://localhost:3001 in your browser

### Custom AMQP URL

```bash
AMQP_URL=amqp://user:pass@host:5672 npm start
```

## How to Play

You are a message consumer. Messages appear in queues as colored blocks:

- 🟢 **Green** = Good message → use `/ack <queue>` to acknowledge
- 🔴 **Red** = Bad message → use `/reject <queue>` to reject

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/ack <queue>` | Acknowledge the top message in a queue |
| `/reject <queue>` | Reject the top message in a queue |
| `/status` | Show current game status |
| `/reset` | Reset game and clear all queues |

### Scoring

- **+10 points** for correct action (ack good, reject bad)
- **-5 points** for wrong action (ack bad, reject good)
- **-100 points** for queue overflow (10 messages)

### Game Mechanics

- Starts with 2 queues, spawn rate of 3 seconds
- New queue appears every 20-30 seconds (max 10 queues)
- Spawn rate increases by 0.2s every 20 seconds (min 0.5s)
- Queue overflows at 10 messages (clears queue, -100 points)

## Tech Stack

- **Backend**: Node.js with `@cloudamqp/amqp-client`
- **Frontend**: Vanilla HTML/CSS/JS
- **Communication**: WebSocket for real-time updates
- **Message Broker**: LavinMQ (AMQP)
