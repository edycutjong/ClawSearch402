import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "clawsearch.db");

let db;

export function initDB() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT NOT NULL,
      agent_address TEXT NOT NULL,
      amount_usdc REAL NOT NULL,
      query TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      result_count INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_payments_agent ON payments(agent_address);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
  `);

  console.log("  ✅ SQLite database initialized");
  return db;
}

export function logPayment({
  txHash,
  agentAddress,
  amountUsdc,
  query,
  endpoint,
  resultCount,
  latencyMs,
}) {
  const stmt = db.prepare(`
    INSERT INTO payments (tx_hash, agent_address, amount_usdc, query, endpoint, result_count, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    txHash,
    agentAddress,
    amountUsdc,
    query,
    endpoint,
    resultCount,
    latencyMs
  );

  return { id: result.lastInsertRowid };
}

export function getStats() {
  const row = db
    .prepare(
      `
    SELECT 
      COUNT(*) as totalQueries,
      COALESCE(SUM(amount_usdc), 0) as totalRevenue,
      COUNT(DISTINCT agent_address) as uniqueAgents,
      COALESCE(AVG(latency_ms), 0) as avgLatency
    FROM payments
  `
    )
    .get();

  return {
    totalQueries: row.totalQueries,
    totalRevenue: Math.round(row.totalRevenue * 1000) / 1000,
    uniqueAgents: row.uniqueAgents,
    avgLatency: Math.round(row.avgLatency),
  };
}

export function getRecent(limit = 50) {
  return db
    .prepare(
      `
    SELECT 
      id,
      tx_hash as txHash,
      agent_address as agent,
      amount_usdc as amount,
      query,
      endpoint,
      result_count as resultCount,
      latency_ms as latencyMs,
      replace(created_at, ' ', 'T') || 'Z' as timestamp
    FROM payments
    ORDER BY created_at DESC
    LIMIT ?
  `
    )
    .all(limit);
}

export function getQueryFrequencies(limit = 20) {
  return db
    .prepare(
      `
    SELECT query, COUNT(*) as count
    FROM payments
    GROUP BY query
    ORDER BY count DESC
    LIMIT ?
  `
    )
    .all(limit);
}
