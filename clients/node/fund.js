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
  const clientKey = 'SB3VKZOSJM6SYSLFH73WLTA2ZVZBEESPTUHSPYELHETVKF6P3R4AF5GD';
  const proxyKey = 'SDUUD4WECOMWHA27MRKQRIK4IA7IRCNSB2CEPIBJWVKJTZD4QB4EOSRW';
  
  await fundAndTrust(clientKey, "Client");
  await fundAndTrust(proxyKey, "Proxy"); 
}

run();
