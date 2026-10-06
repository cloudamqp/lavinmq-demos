const amqp = require("amqplib");
const config = require("./shared/config");
const { log } = require("./shared/logger");

async function setup() {
  if (!config.amqpUrl) {
    throw new Error("AMQP_URL is missing in .env");
  }

  const connection = await amqp.connect(config.amqpUrl);
  const channel = await connection.createChannel();

  const transactionsQueue = config.queues.transactions;
  const retryQueue = config.queues.retry;
  const deadQueue = config.queues.dead;
  const deadLetterExchange = config.exchanges.dlx;

  await channel.assertExchange(deadLetterExchange, "direct", {
    durable: true,
  });

  await channel.assertQueue(transactionsQueue, {
    durable: true,
  });

  await channel.assertQueue(retryQueue, {
    durable: true,
    messageTtl: 5000,
    deadLetterExchange: "",
    deadLetterRoutingKey: transactionsQueue,
  });

  await channel.assertQueue(deadQueue, {
    durable: true,
  });

  await channel.bindQueue(deadQueue, deadLetterExchange, deadQueue);

  log("RabbitMQ setup completed", {
    transactionsQueue,
    retryQueue,
    deadQueue,
    deadLetterExchange,
  });

  await channel.close();
  await connection.close();
}

setup().catch((error) => {
  console.error(error);
  process.exit(1);
});