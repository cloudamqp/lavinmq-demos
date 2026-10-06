const amqp = require("amqplib");
const config = require("../shared/config");
const { log } = require("../shared/logger");

let connection;
let channel;
let shuttingDown = false;
let messageHandler;
let reconnectTimer;

async function connect() {
  if (!config.amqpUrl) {
    throw new Error("AMQP_URL is not defined in the environment variables");
  }

  connection = await amqp.connect(config.amqpUrl);
  channel = await connection.createChannel();

  connection.on("close", reconnect);

  connection.on("error", (error) => {
    log("Connection error", {
      error: error.message,
    });
  });

  channel.on("error", (error) => {
    log("Channel error", {
      error: error.message,
    });
  });
}

async function publishTransaction(transaction, scenario) {
  channel.sendToQueue(
    config.queues.transactions,
    Buffer.from(JSON.stringify(transaction)),
    {
      persistent: true,
      contentType: "application/json",
      headers: {
        scenario,
      },
    }
  );
}

async function subscribe(handler) {
  messageHandler = handler;

  await channel.prefetch(1);

  await channel.consume(
    config.queues.transactions,
    (message) => {
      if (!message) return;

      const transaction = JSON.parse(
        message.content.toString()
      );

      const retries = Number(
        message.properties.headers?.["x-retry-count"] || 0
      );

      handler({
        transaction,
        retries,
        originalMessage: message,
      });
    },
    {
      noAck: false,
    }
  );
}

async function acknowledge(originalMessage) {
  channel.ack(originalMessage);
}

async function retry(transaction, retryCount) {
  channel.sendToQueue(
    config.queues.retry,
    Buffer.from(JSON.stringify(transaction)),
    {
      persistent: true,
      contentType: "application/json",
      headers: {
        "x-retry-count": retryCount,
      },
    }
  );
}

async function sendToDeadQueue(transaction, error, retries) {
  channel.publish(
    config.exchanges.dlx,
    config.queues.dead,
    Buffer.from(
      JSON.stringify({
        transaction,
        failedAt: new Date().toISOString(),
        reason: error.message,
        retries,
      })
    ),
    {
      persistent: true,
      contentType: "application/json",
    }
  );
}

function reconnect() {
  if (shuttingDown || !messageHandler || reconnectTimer) {
    return;
  }

  log("Connection closed. Reconnecting in 5 seconds...");

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    try {
      await connect();
      await subscribe(messageHandler);

      log("Reconnected to RabbitMQ");
    } catch (error) {
      log("Reconnect failed", {
        error: error.message,
      });

      reconnect();
    }
  }, 5000);
}

async function close() {
  shuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (error) {
    log("Shutdown error", {
      error: error.message,
    });
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