const config = require("./shared/config");
const { log } = require("./shared/logger");
const { processTransaction } = require("./shared/banking-agent");
const {
  saveResult,
  hasProcessed,
} = require("./shared/transaction-store");

const broker = require("./broker");

async function startWorker() {
  try {
    await broker.connect();
    await broker.subscribe(handleMessage);

    log("Worker started, waiting for messages...", {
      queue: config.queues.transactions,
    });
  } catch (error) {
    log("Error starting worker", {
      error: error.message,
    });

    setTimeout(startWorker, 5000);
  }
}

async function handleMessage({
  transaction,
  retries,
  originalMessage,
}) {
  try {
    log("Processing transaction", {
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      retries,
    });

    if (hasProcessed(transaction.transactionId)) {
      log("Transaction already processed, acknowledging message", {
        transactionId: transaction.transactionId,
      });

      await broker.acknowledge(originalMessage);
      return;
    }

    const result = await processTransaction(transaction);

    saveResult(transaction.transactionId, result);

    log("Transaction processed successfully", result);

    await broker.acknowledge(originalMessage);
  } catch (error) {
    log("Transaction failed", {
      transactionId: transaction.transactionId,
      error: error.message,
      retryable: error.retryable,
      retries,
    });

    if (error.retryable && retries < config.maxRetries) {
      await broker.retry(
        transaction,
        retries + 1
      );

      log("Message sent to retry queue", {
        transactionId: transaction.transactionId,
        retryCount: retries + 1,
      });

      await broker.acknowledge(originalMessage);
      return;
    }

    await broker.sendToDeadQueue(
      transaction,
      error,
      retries
    );

    log("Transaction sent to dead queue", {
      transactionId: transaction.transactionId,
      reason: error.message,
    });

    await broker.acknowledge(originalMessage);
  }
}

async function shutdown() {
  log("Shutting down worker...");

  await broker.close();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startWorker();