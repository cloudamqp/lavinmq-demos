const client = process.env.AMQP_CLIENT || "amqplib";

if (client === "amqp-client") {
  module.exports = require("./amqp-client/broker");
} else if (client === "amqplib") {
  module.exports = require("./amqplib/broker");
} else {
  throw new Error(
    `Unsupported AMQP_CLIENT "${client}". Use "amqplib" or "amqp-client".`
  );
}