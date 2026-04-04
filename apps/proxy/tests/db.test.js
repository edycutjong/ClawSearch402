import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

const mocks = vi.hoisted(() => ({
  db: null
}));

vi.mock('better-sqlite3', async (importOriginal) => {
  const mod = await importOriginal();
  mocks.db = new mod.default(':memory:');
  return {
    default: function() { return mocks.db; }
  };
});

vi.mock('fs', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    default: {
      ...mod.default,
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
    }
  };
});

import { initDB, logPayment, getStats, getRecent, getQueryFrequencies } from '../src/db.js';

describe('db.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initDB();
    if (mocks.db) {
      mocks.db.exec('DELETE FROM payments');
    }
  });

  it('initDB handles missing directory', () => {
    fs.existsSync.mockReturnValueOnce(false);
    initDB();
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('logs a payment and retrieves it', () => {
    const record = logPayment({
      txHash: 'tx1',
      agentAddress: 'agent1',
      amountUsdc: 0.001,
      query: 'test query',
      endpoint: '/search',
      resultCount: 10,
      latencyMs: 100
    });
    expect(record).toHaveProperty('id');

    const recent = getRecent(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].txHash).toBe('tx1');
    expect(recent[0].agent).toBe('agent1');
  });

  it('computes correct stats for multiple payments', () => {
    logPayment({ txHash: 'tx1', agentAddress: 'agent1', amountUsdc: 0.001, query: 'test query', endpoint: '/search', resultCount: 10, latencyMs: 100 });
    logPayment({ txHash: 'tx2', agentAddress: 'agent2', amountUsdc: 0.005, query: 'test query', endpoint: '/search/enriched', resultCount: 20, latencyMs: 200 });
    logPayment({ txHash: 'tx3', agentAddress: 'agent1', amountUsdc: 0.001, query: 'other query', endpoint: '/search', resultCount: 5, latencyMs: 150 });
    
    // Test stats (amounts sum up, unique agents calculated)
    const stats = getStats();
    expect(stats.totalQueries).toBe(3);
    expect(stats.totalRevenue).toBe(0.007);
    expect(stats.uniqueAgents).toBe(2);
    expect(stats.avgLatency).toBe(150); // (100+200+150)/3 = 150
    
    // Test query frequencies counts
    const freqs = getQueryFrequencies(5);
    expect(freqs).toHaveLength(2);
    expect(freqs[0].query).toBe('test query');
    expect(freqs[0].count).toBe(2);
    expect(freqs[1].query).toBe('other query');
    expect(freqs[1].count).toBe(1);
    
    // Empty db stats fallback
    mocks.db.exec('DELETE FROM payments');
    const emptyStats = getStats();
    expect(emptyStats.totalRevenue).toBe(0);
    expect(emptyStats.avgLatency).toBe(0);
  });
});

