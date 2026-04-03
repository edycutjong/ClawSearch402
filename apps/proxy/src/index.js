import "dotenv/config";
import express from "express";
import cors from "cors";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { initDB, logPayment, getStats, getRecent } from "./db.js";
import { search } from "./search.js";
import { emitPaymentEvent, sseHandler } from "./events.js";

const app = express();
const PORT = process.env.PORT || 3001;
const PAY_TO = process.env.PAY_TO;
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

if (!PAY_TO) {
  console.error("❌ PAY_TO environment variable is required");
  process.exit(1);
}

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: [DASHBOARD_URL, "http://localhost:3000"] }));
app.use(express.json());

// ── x402 Payment Routes ──────────────────────────────────
const routes = {
  "GET /search": {
    accepts: [
      {
        network: "stellar:testnet",
        scheme: "exact",
        price: "0.001",
        payTo: PAY_TO,
      },
    ],
    description: "Web search — 10 results (titles, URLs, snippets)",
    mimeType: "application/json",
  },
  "GET /search/enriched": {
    accepts: [
      {
        network: "stellar:testnet",
        scheme: "exact",
        price: "0.005",
        payTo: PAY_TO,
      },
    ],
    description: "Enriched web search — metadata, favicons, full snippets",
    mimeType: "application/json",
  },
};

app.use(
  paymentMiddlewareFromConfig(
    routes,
    new HTTPFacilitatorClient(FACILITATOR_URL),
    [{ network: "stellar:testnet", server: new ExactStellarScheme() }]
  )
);

// ── Init Database ────────────────────────────────────────
initDB();

// ── Protected Endpoints (x402-gated) ────────────────────

app.get("/search", async (req, res) => {
  const startTime = Date.now();
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Missing ?q= parameter" });
  }

  try {
    const results = await search(query, { enriched: false });
    const latencyMs = Date.now() - startTime;

    // Extract agent address from payment headers
    const paymentHeader = req.headers["payment-response"];
    let agentAddress = "unknown";
    let txHash = "unknown";

    if (paymentHeader) {
      try {
        const payment = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString()
        );
        agentAddress = payment.payer || "unknown";
        txHash = payment.transaction || "unknown";
      } catch {
        // Payment header parsing is best-effort
      }
    }

    // Log payment to SQLite
    const paymentRecord = logPayment({
      txHash,
      agentAddress,
      amountUsdc: 0.001,
      query: String(query),
      endpoint: "/search",
      resultCount: results.length,
      latencyMs,
    });

    // Emit SSE event for dashboard
    emitPaymentEvent({
      id: paymentRecord.id,
      agent: agentAddress,
      amount: 0.001,
      query: String(query),
      endpoint: "/search",
      txHash,
      resultCount: results.length,
      latencyMs,
      timestamp: new Date().toISOString(),
    });

    res.json({
      query: String(query),
      resultCount: results.length,
      results,
      meta: {
        latencyMs,
        paidUsdc: 0.001,
        txHash,
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed", message: err.message });
  }
});

app.get("/search/enriched", async (req, res) => {
  const startTime = Date.now();
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Missing ?q= parameter" });
  }

  try {
    const results = await search(query, { enriched: true });
    const latencyMs = Date.now() - startTime;

    const paymentHeader = req.headers["payment-response"];
    let agentAddress = "unknown";
    let txHash = "unknown";

    if (paymentHeader) {
      try {
        const payment = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString()
        );
        agentAddress = payment.payer || "unknown";
        txHash = payment.transaction || "unknown";
      } catch {
        // best-effort
      }
    }

    const paymentRecord = logPayment({
      txHash,
      agentAddress,
      amountUsdc: 0.005,
      query: String(query),
      endpoint: "/search/enriched",
      resultCount: results.length,
      latencyMs,
    });

    emitPaymentEvent({
      id: paymentRecord.id,
      agent: agentAddress,
      amount: 0.005,
      query: String(query),
      endpoint: "/search/enriched",
      txHash,
      resultCount: results.length,
      latencyMs,
      timestamp: new Date().toISOString(),
    });

    res.json({
      query: String(query),
      resultCount: results.length,
      results,
      meta: {
        latencyMs,
        paidUsdc: 0.005,
        txHash,
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed", message: err.message });
  }
});

// ── Free Endpoints ───────────────────────────────────────

// Server info
app.get("/", (_req, res) => {
  res.json({
    name: "ClawSearch 402",
    version: "0.1.0",
    description:
      "Pay-per-query web search for AI agents via x402 + Stellar USDC",
    network: "stellar:testnet",
    endpoints: {
      "/search?q=<query>": { price: "$0.001 USDC", method: "GET" },
      "/search/enriched?q=<query>": { price: "$0.005 USDC", method: "GET" },
      "/.well-known/x402": { price: "free", method: "GET" },
      "/openapi.json": { price: "free", method: "GET" },
      "/health": { price: "free", method: "GET" },
      "/api/events": { price: "free", method: "GET", type: "SSE" },
      "/api/stats": { price: "free", method: "GET" },
      "/api/recent": { price: "free", method: "GET" },
    },
  });
});

// x402 discovery
app.get("/.well-known/x402", (_req, res) => {
  res.json({
    version: "0.2.0",
    facilitatorUrl: FACILITATOR_URL,
    payTo: PAY_TO,
    network: "stellar:testnet",
    routes: Object.entries(routes).map(([route, config]) => {
      const [method, path] = route.split(" ");
      const paymentOption = Array.isArray(config.accepts) ? config.accepts[0] : config.accepts;
      return {
        method,
        path,
        scheme: paymentOption.scheme,
        price: paymentOption.price,
        description: config.description,
        mimeType: config.mimeType,
      };
    }),
  });
});

// OpenAPI spec
app.get("/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "ClawSearch 402",
      version: "0.1.0",
      description:
        "x402-gated web search proxy — pay $0.001 USDC per query with Stellar",
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {
      "/search": {
        get: {
          summary: "Web search (x402-gated)",
          description: "Returns 10 web search results. Requires x402 payment.",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Search query string",
            },
          ],
          responses: {
            200: { description: "Search results" },
            402: { description: "Payment required" },
          },
          "x-payment-info": {
            scheme: "exact",
            network: "stellar:testnet",
            price: "$0.001",
            payTo: PAY_TO,
          },
        },
      },
    },
  });
});

// Health check
app.get("/health", (_req, res) => {
  const stats = getStats();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    version: "0.1.0",
    network: "stellar:testnet",
    ...stats,
  });
});

// ── Analytics API (for Dashboard) ────────────────────────

app.get("/api/stats", (_req, res) => {
  const stats = getStats();
  res.json(stats);
});

app.get("/api/recent", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const recent = getRecent(limit);
  res.json(recent);
});

app.get("/api/events", sseHandler);

// ── Start Server ─────────────────────────────────────────

app.listen(PORT, () => {
  console.log("");
  console.log("  🔍 ClawSearch 402");
  console.log(`  ├─ Server:     http://localhost:${PORT}`);
  console.log(`  ├─ Network:    Stellar Testnet`);
  console.log(`  ├─ Pay-to:     ${PAY_TO}`);
  console.log(`  ├─ Facilitator: ${FACILITATOR_URL}`);
  console.log(`  └─ Dashboard:  ${DASHBOARD_URL}`);
  console.log("");
  console.log("  📡 Endpoints:");
  console.log(`     GET /search?q=<query>          → $0.001 USDC`);
  console.log(`     GET /search/enriched?q=<query>  → $0.005 USDC`);
  console.log(`     GET /.well-known/x402           → free`);
  console.log(`     GET /api/events                 → SSE stream`);
  console.log("");
});
