const { v4: uuidv4 } = require("uuid");
const broker = require("./broker");
const { log } = require("./shared/logger");

function createTransaction(scenario) {
  const base = {
    transactionId: uuidv4(),
    fromAccount: "ACC-1001",
    toAccount: "ACC-2002",
    currency: "SEK",
    type: "transfer",
    createdAt: new Date().toISOString(),
  };

  switch (scenario) {
    case "valid":
      return { ...base, amount: 250 };

    case "invalid":
      return { ...base, amount: -100 };

    case "review":
      return { ...base, amount: 15000 };

    case "temporary-failure":
      return { ...base, amount: 500 };

    case "random":
    default:
      return {
        ...base,
        amount: Math.floor(Math.random() * 15000) + 1,
      };
  }
}

async function publishTransaction() {
  const scenario = process.argv[2] || "random";

  const transaction = {
    ...createTransaction(scenario),
    scenario,
  };

  await broker.connect();

  await broker.publishTransaction(
    transaction,
    scenario
  );

  log("Transaction published", {
    scenario,
    ...transaction,
  });

  await broker.close();
}

publishTransaction().catch((error) => {
  console.error(error);
  process.exit(1);
});