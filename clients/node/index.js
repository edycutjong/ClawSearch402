#!/usr/bin/env node

/**
 * ClawSearch 402 — Agent Client
 *
 * Autonomous AI agent client that discovers, pays, and receives
 * web search results via the x402 protocol on Stellar.
 *
 * Usage:
 *   node index.js "what is x402 protocol"
 *   node index.js "stellar smart contracts" --enriched
 *   node index.js --demo  (fires 10 rapid queries for dashboard demo)
 */

import "dotenv/config";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactStellarClient } from "@x402/stellar";
import { createEd25519Signer } from "@x402/stellar";

// ── Configuration ────────────────────────────────────────
const PROXY_URL = process.env.PROXY_URL || "http://localhost:3001";
const PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌ STELLAR_PRIVATE_KEY is required in .env");
  console.error("   Generate a testnet keypair at: https://laboratory.stellar.org/#account-creator");
  process.exit(1);
}

// ── Setup x402 Client ────────────────────────────────────
const signer = createEd25519Signer(PRIVATE_KEY, "stellar:testnet");
const client = new x402Client()
  .register("stellar:*", new ExactStellarClient(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// ── Search Function ──────────────────────────────────────
async function searchClawSearch(query, { enriched = false } = {}) {
  const endpoint = enriched ? "/search/enriched" : "/search";
  const url = `${PROXY_URL}${endpoint}?q=${encodeURIComponent(query)}`;

  console.log(`\n  🔍 Searching: "${query}"`);
  console.log(`  📡 ${url}`);
  console.log(`  💰 Price: $${enriched ? "0.005" : "0.001"} USDC`);
  console.log("");

  const startTime = Date.now();

  try {
    const response = await fetchWithPayment(url, { method: "GET" });
    const latency = Date.now() - startTime;

    if (!response.ok) {
      console.error(`  ❌ Request failed: ${response.status} ${response.statusText}`);
      const body = await response.text();
      console.error(`     ${body}`);
      return null;
    }

    const data = await response.json();

    // Display results
    console.log(`  ✅ Payment settled! (${latency}ms)`);
    console.log(`  📊 ${data.resultCount} results returned`);

    if (data.meta?.txHash && data.meta.txHash !== "unknown") {
      console.log(`  🔗 Tx: https://stellar.expert/explorer/testnet/tx/${data.meta.txHash}`);
    }

    console.log("");
    console.log("  ── Results ──────────────────────────────────");

    for (const [i, result] of (data.results || []).entries()) {
      console.log(`  ${i + 1}. ${result.title}`);
      console.log(`     ${result.url}`);
      if (result.snippet) {
        console.log(`     ${result.snippet.slice(0, 120)}...`);
      }
      console.log("");
    }

    return data;
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`  ❌ Error after ${latency}ms: ${err.message}`);
    return null;
  }
}

// ── Demo Mode ────────────────────────────────────────────
async function runDemo() {
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

  console.log("\n  🚀 Demo Mode — Firing 10 queries to light up the dashboard\n");
  console.log("  ─────────────────────────────────────────────────────────\n");

  for (const query of queries) {
    await searchClawSearch(query);
    // Small delay between queries for visual effect on dashboard
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n  ✅ Demo complete! Check the dashboard for live updates.");
  console.log("  📊 http://localhost:3000\n");
}

// ── CLI Entry Point ──────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--demo")) {
  runDemo();
} else if (args.length === 0) {
  console.log("\n  🔍 ClawSearch 402 — Agent Client\n");
  console.log("  Usage:");
  console.log('    node index.js "your search query"');
  console.log('    node index.js "query" --enriched');
  console.log("    node index.js --demo\n");
} else {
  const enriched = args.includes("--enriched");
  const query = args.filter((a) => !a.startsWith("--")).join(" ");
  searchClawSearch(query, { enriched });
}
