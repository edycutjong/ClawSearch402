import pkg from '@stellar/stellar-sdk';
const { Keypair, Horizon, TransactionBuilder, Networks, Asset, Operation } = pkg;
import 'dotenv/config';

// The Testnet USDC issuer
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new Asset('USDC', USDC_ISSUER);

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

async function fundAndTrust(secretKey, name) {
  const keypair = Keypair.fromSecret(secretKey);
  const publicKey = keypair.publicKey();
  console.log(`Setting up ${name} Wallet: ${publicKey}`);

  // 1. Fund with Friendbot
  try {
    console.log(`Funding ${name} with friendbot...`);
    const response = await fetch(`https://horizon-testnet.stellar.org/friendbot?addr=${publicKey}`);
    const data = await response.json();
    if (response.ok) {
      console.log(`✅ Funded ${name} with testnet XLM.`);
    } else {
      console.log(`ℹ️ ${name} may already be funded. Message: ${data.detail}`);
    }
  } catch (err) {
    console.error(`Error funding ${name}:`, err);
  }

  // 2. Add Trustline for USDC
  try {
    const account = await server.loadAccount(publicKey);

    // Check if trustline already exists
    const hasTrustline = account.balances.some(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);
    if (hasTrustline) {
      console.log(`✅ ${name} already has a trustline for Testnet USDC.`);
      return;
    }

    console.log(`Adding trustline for USDC to ${name}...`);
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.changeTrust({
        asset: USDC_ASSET
      }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const txResult = await server.submitTransaction(tx);
    console.log(`✅ Trustline added for ${name}! TxHash: ${txResult.hash}`);
  } catch (err) {
    console.error(`Error adding trustline for ${name}:`);
    if (err.response && err.response.data) {
      console.error(err.response.data);
    } else {
      console.error(err);
    }
  }
}

async function run() {
  console.log("Generating new testnet keypairs...\n");
  
  const clientKeypair = Keypair.random();
  const proxyKeypair = Keypair.random();

  const clientSecret = clientKeypair.secret();
  const proxySecret = proxyKeypair.secret();
  const proxyPublic = proxyKeypair.publicKey();

  await fundAndTrust(clientSecret, "Client");
  console.log("---");
  await fundAndTrust(proxySecret, "Proxy"); 

  if (!process.env.SPONSOR_PRIVATE_KEY) {
    console.log("\n⚠️  No SPONSOR_PRIVATE_KEY found in .env. Skipping 1.0 USDC funding test.");
    console.log("   (Your accounts have Trustlines and XLM, but lack the USDC required to search!)");
  } else {
    console.log("\nFunding Client with 1.0 testnet USDC from Sponsor Account...");
    try {
      const sponsorKeypair = Keypair.fromSecret(process.env.SPONSOR_PRIVATE_KEY);
      const sponsorAcc = await server.loadAccount(sponsorKeypair.publicKey());
      
      const tx = new TransactionBuilder(sponsorAcc, {
        fee: '100',
        networkPassphrase: Networks.TESTNET
      })
        .addOperation(Operation.payment({
          destination: clientKeypair.publicKey(),
          asset: USDC_ASSET,
          amount: "1.0000000"
        }))
        .setTimeout(30)
        .build();

      tx.sign(sponsorKeypair);
      await server.submitTransaction(tx);
      console.log("✅ Client successfully received 1.0 testnet USDC for testing!");
    } catch (e) {
      console.error("❌ Failed to sponsor USDC to the client:", e);
    }
  }

  console.log("\n=======================================================");
  console.log("🎉 SUCCESS! Your testnet accounts are funded and ready.");
  console.log("=======================================================\n");

  console.log("1️⃣  Update clients/node/.env with the CLIENT secret key:");
  console.log(`STELLAR_PRIVATE_KEY=${clientSecret}\n`);

  console.log("2️⃣  Update apps/proxy/.env with the PROXY public address (PAY_TO):");
  console.log(`PAY_TO=${proxyPublic}\n`);

  console.log("⚠️  IMPORTANT: Save your Proxy Secret Key to withdraw your accumulated USDC later!");
  console.log(`Proxy Secret Key: ${proxySecret}\n`);
}

run();
