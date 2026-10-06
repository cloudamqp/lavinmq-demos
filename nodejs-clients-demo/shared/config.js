require("dotenv").config();

module.exports = {
  amqpUrl: process.env.AMQP_URL,

  queues: {
    transactions: process.env.TRANSACTIONS_QUEUE || "banking.transactions",
    retry: process.env.TRANSACTIONS_RETRY_QUEUE || "banking.transactions.retry",
    dead: process.env.TRANSACTIONS_DEAD_QUEUE || "banking.transactions.dead",
  },

  exchanges: {
    dlx: process.env.TRANSACTIONS_DLX || "banking.transactions.dlx",
  },

  maxRetries: Number(process.env.MAX_RETRIES || 3),
};