import pkg from '@stellar/stellar-sdk';
import 'dotenv/config';

const { Keypair, Horizon } = pkg;
const server = new Horizon.Server('https://horizon-testnet.stellar.org');

const clientSecret = process.env.CLIENT_SECRET || process.env.STELLAR_PRIVATE_KEY;
const proxySecret = process.env.PROXY_SECRET;

if (!clientSecret || !proxySecret) {
  console.error("❌ Please set CLIENT_SECRET (or STELLAR_PRIVATE_KEY) and PROXY_SECRET in your .env");
  process.exit(1);
}

const origClient = Keypair.fromSecret(clientSecret);
const origProxy = Keypair.fromSecret(proxySecret);

console.log("Client Pub:", origClient.publicKey());
console.log("Proxy Pub:", origProxy.publicKey());
try {
  const clientAcc = await server.loadAccount(origClient.publicKey());
  console.log("Client balances:", clientAcc.balances);
  const proxyAcc = await server.loadAccount(origProxy.publicKey());
  console.log("Proxy balances:", proxyAcc.balances);
} catch (e) {
  console.log(e);
}
