# LavinMQ Queue Game - Plan

## Game Rules

| Rule | Description |
|------|-------------|
| **Spawn Rate** | 5s per queue initially, -0.2s every 20s (min 0.5s) |
| **Queue Overflow** | At 10 messages, queue drops: +10 per 🟢, -10 per 🔴 |
| **Starting Queues** | 2 queues |
| **New Queues** | Add 1 queue every 20-30s (randomized) |
| **Game Mode** | Infinite - survive and maximize score |

## Queue Names

Inspired by CloudAMQP plans - animal themes with numbers:

```
lemming-1, lemur-2, orca-3, panda-4, rhino-5,
tiger-6, whale-7, hippo-8, bunny-9, pika-10...
```

## Visual Mockup

```
┌─────────────────────────────────────────────────────┐
│                  QUEUE THE PIKA                     │
│                                                     │
│   Score: 140    Spawn Rate: 4.2s    Queues: 3      │
│                                                     │
│      ┌───┐      ┌───┐      ┌───┐                   │
│      │ 🔴│      │ 🟢│      │ 🔴│                   │
│      │ 🟢│      │ 🔴│      └───┘                   │
│      │ 🟢│      │ 🟢│                              │
│      │ 🔴│      └───┘                              │
│      └───┘                                          │
│    lemming-1    lemur-2    orca-3                  │
│                                                     │
│  ┌────────────────────────────────────────────────┐│
│  │ > /ack lemur-2                             │    │
│  │ ✓ Acknowledged good message from lemur-2   │    │
│  │ > _                                        │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  /help /ack <queue> /reject <queue> /status        │
└─────────────────────────────────────────────────────┘
```

## CLI Commands

| Command | Action |
|---------|--------|
| `/help` | Show commands |
| `/ack <queue>` | Consume top message (correct for 🟢) |
| `/reject <queue>` | Reject top message (correct for 🔴) |
| `/status` | Show detailed stats |

## Technical Implementation

### Stack
- **Backend**: Node.js + `amqp-client.js`
- **Frontend**: Vanilla HTML/CSS/JS
- **Communication**: WebSocket

### File Structure
```
queue-the-pika/
├── server.js          # Node server, AMQP + WebSocket
├── public/
│   ├── index.html     # Game UI
│   ├── style.css      # LavinMQ-inspired styling
│   └── game.js        # Client logic + CLI
└── package.json
```

### AMQP Flow
1. Server connects to LavinMQ via `amqp-client.js`
2. Game creates queues dynamically with fun names
3. Timer publishes messages with `{ type: "good" | "bad" }`
4. Player commands → server → AMQP ack/reject
5. State synced to frontend via WebSocket
