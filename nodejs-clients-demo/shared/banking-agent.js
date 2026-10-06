async function processTransaction(transaction) {
  await sleep(1000);

  if (transaction.amount <= 0) {
    const error = new Error("Invalid transaction amount");
    error.retryable = false;
    throw error;
  }

  if (transaction.amount > 10000) {
    const error = new Error("High-value transaction requires manual review");
    error.retryable = false;
    throw error;
  }

  if (transaction.scenario === "temporary-failure") {
    const error = new Error("Temporary banking service unavailable");
    error.retryable = true;
    throw error;
  }

  if (transaction.scenario === "random" && Math.random() < 0.25) {
    const error = new Error("Temporary banking service unavailable");
    error.retryable = true;
    throw error;
  }

  return {
    transactionId: transaction.transactionId,
    status: "completed",
    processedAt: new Date().toISOString(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { processTransaction };