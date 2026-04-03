import "dotenv/config";
import { search } from "./src/search.js";
import { initDB, logPayment } from "./src/db.js";
import { emitPaymentEvent } from "./src/events.js";

// Ensure DB is initialized
initDB();

const queries = [
  "x402 payment protocol",
  "stellar blockchain USDC",
  "autonomous AI agents",
  "machine to machine payments",
  "coinbase stablecoin payments",
  "soroban smart contracts",
  "HTTP 402 payment required",
  "web search API pricing",
  "AI agent infrastructure 2026",
  "decentralized micropayments",
];

const agents = [
  "GABYV2YFXNY4G5G4Z3Y4HGE4M6BFW5Z6XY7RQ3R2D3RQQEGE4DGEEWW3",
  "GBCW7A2N7K6VY5AFLZLQ7VXJQ5NZYXVRQ3WQQEGE4DGQ7VXJQ5NZYXVR",
  "GDJ7B2N7K6VY5AFLZLQ7VXJQ5NZYXVRQ3WQQEGE4DGQ7VXJQ5NZYXV99",
];

async function runDemo() {
  console.log("\n  🚀 Running ClawSearch 402 Live Ledger Demo\n");

  for (const query of queries) {
    console.log(`  🔍 Agent querying: "${query}"`);
    const startTime = Date.now();
    
    // Do a real search to be authentic
    let results = [];
    try {
       results = await search(query, { enriched: false });
    } catch(e) {}
    
    const latencyMs = Date.now() - startTime;
    const isEnriched = Math.random() > 0.6;
    const endpoint = isEnriched ? "/search/enriched" : "/search";
    const amount = isEnriched ? 0.005 : 0.001;
    
    // Generate fake stellar agent address
    const agentAddress = agents[Math.floor(Math.random() * agents.length)];
    const txHash = Math.random().toString(16).substring(2, 10).repeat(8);

    const paymentRecord = logPayment({
      txHash,
      agentAddress,
      amountUsdc: amount,
      query,
      endpoint,
      resultCount: results.length,
      latencyMs,
    });

    emitPaymentEvent({
      id: paymentRecord.id,
      agent: agentAddress,
      amount: amount,
      query,
      endpoint,
      txHash,
      resultCount: results.length,
      latencyMs,
      timestamp: new Date().toISOString(),
    });

    console.log(`  ✅ Logged and emitted SSE payment. (${latencyMs}ms)\n`);
    // Random delay between 1.5 and 3.5 seconds
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
  }
}

runDemo();
