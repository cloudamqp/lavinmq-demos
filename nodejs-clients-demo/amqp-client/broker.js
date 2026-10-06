const { AMQPSession } = require("@cloudamqp/amqp-client");
const config = require("../shared/config");
const { log } = require("../shared/logger");

let session;
let transactionsQueue;
let retryQueue;
let deadExchange;

async function connect() {
  if (!config.amqpUrl) {
    throw new Error("AMQP_URL is not defined in the environment variables");
  }

  session = await AMQPSession.connect(config.amqpUrl, {
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    backoffMultiplier: 2,
    maxRetries: 0,

    onconnect: () => {
      log("Connected to RabbitMQ");
    },

    ondisconnect: (error) => {
      log("Disconnected from RabbitMQ", {
        error: error?.message,
      });
    },

    onfailed: (error) => {
      log("Failed to reconnect to RabbitMQ", {
        error: error?.message,
      });
    },
  });

  transactionsQueue = await session.queue(
    config.queues.transactions,
    {
      durable: true,
    }
  );

  retryQueue = await session.queue(
  config.queues.retry,
  {
    durable: true,
    arguments: {
      "x-message-ttl": 5000,
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": config.queues.transactions,
    },
  }
);

  deadExchange = await session.directExchange(
    config.exchanges.dlx,
    {
      durable: true,
    }
  );
}

async function publishTransaction(transaction, scenario) {
  await transactionsQueue.publish(
    JSON.stringify(transaction),
    {
      deliveryMode: 2,
      contentType: "application/json",
      headers: {
        scenario,
      },
    }
  );
}

async function subscribe(handler) {
  await transactionsQueue.subscribe(
    {
      prefetch: 1,
      manualAck: true,
    },
    async (message) => {
      const transaction = JSON.parse(
        message.bodyString()
      );

      const retries = Number(
        message.properties?.headers?.["x-retry-count"] || 0
      );

      await handler({
        transaction,
        retries,
        originalMessage: message,
      });
    }
  );
}

async function acknowledge(originalMessage) {
  await originalMessage.ack();
}

async function retry(transaction, retryCount) {
  await retryQueue.publish(
    JSON.stringify(transaction),
    {
      deliveryMode: 2,
      contentType: "application/json",
      headers: {
        "x-retry-count": retryCount,
      },
    }
  );
}

async function sendToDeadQueue(transaction, error, retries) {
  await deadExchange.publish(
    JSON.stringify({
      transaction,
      failedAt: new Date().toISOString(),
      reason: error.message,
      retries,
    }),
    {
      routingKey: config.queues.dead,
      deliveryMode: 2,
      contentType: "application/json",
    }
  );
}

async function close() {
  if (session) {
    await session.stop();
  }
}

module.exports = {
  connect,
  publishTransaction,
  subscribe,
  acknowledge,
  retry,
  sendToDeadQueue,
  close,
};