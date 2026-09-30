// Stub for optional peer deps of wallet connectors we never use
// (Coinbase CDP x402 payment modules, Solana kit, etc.). The real
// imports only execute when a user uses those connectors/payment
// flows, which this app never does. Any named export resolves to a
// function that throws if actually called.
module.exports = new Proxy(
  {},
  {
    get: () => () => {
      throw new Error("Optional wallet module is not available");
    },
  }
);
