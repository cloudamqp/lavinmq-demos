# Banking Application with Node.js and LavinMQ

This is a simple banking application I built to demonstrate reliable message processing with Node.js and LavinMQ.

The demo includes a producer that publishes banking transactions and a worker that processes them. It demonstrates retries, dead-lettering, manual acknowledgements, idempotent processing, and connection recovery.

I also use the same application to compare two Node.js AMQP clients:

- `amqplib`
- `@cloudamqp/amqp-client`

The producer, worker, and transaction-processing logic are shared between the two clients. Only the broker implementation changes.

- `producer.js` creates and publishes banking transactions.
- `worker.js` consumes and processes transactions.
- `broker.js` selects which AMQP client implementation to use.
- `amqplib/broker.js` contains the `amqplib` implementation.
- `amqp-client/broker.js` contains the `amqp-client.js` implementation.
- `setup.js` creates the queues, exchange, and bindings used by the demo.
- `shared/` contains the banking logic and other code shared by both implementations.

## Getting started

Install the dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Then add your LavinMQ connection URL to `.env`:

```text
AMQP_URL=your_lavinmq_url
```

Set up the queues, exchange, and bindings:

```bash
npm run setup
```

## Run with `amqplib`

Start the worker:

```bash
npm run worker:amqplib
```

In another terminal, publish a transaction:

```bash
npm run producer:amqplib -- valid
```

## Run with `amqp-client.js`

Start the same worker with `amqp-client.js`:

```bash
npm run worker:amqp-client
```

Then publish a transaction:

```bash
npm run produce:amqp-client -- valid
```

## Try different transaction scenarios

The producer supports different scenarios:

```bash
npm run produce:amqp-client -- valid
npm run produce:amqp-client -- temporary-failure
npm run produce:amqp-client -- invalid
npm run produce:amqp-client -- review
npm run produce:amqp-client -- random
```

Replace `amqp-client` with `amqplib` to run the same scenarios with `amqplib`.

## What this demo shows

The main idea I wanted to demonstrate is that the application logic doesn't have to change when switching AMQP clients.

The producer still publishes transactions, the worker still processes them, and the retry and dead-letter strategies remain the same.

The client-specific differences stay inside the broker layer:

```text
Application
     │
     ▼
  broker.js
     │
 ┌───┴───────────┐
 ▼               ▼
amqplib       amqp-client.js
broker           broker
     │               │
     └───────┬───────┘
             ▼
          LavinMQ
```

This makes it possible to run the same banking application with either client and compare how they handle publishing, consuming, acknowledgements, and connection recovery.