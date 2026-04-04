import { vi, describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  db: null,
  searchRes: [{ title: 'mocked title', url: 'http://mock', snippet: 'mock' }],
  searchError: null
}));

// Mock better-sqlite3 to run in memory
vi.mock('better-sqlite3', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    default: class MockDb extends mod.default {
      constructor() {
        super(':memory:');
        mocks.db = this;
      }
    }
  };
});

// Mock search module
vi.mock('../src/search.js', () => ({
  search: vi.fn(async (query, opts) => {
    if (mocks.searchError) throw mocks.searchError;
    return mocks.searchRes;
  })
}));

// Mock the middleware to just pass through so we can test route logic
vi.mock('@x402/express', () => ({
  paymentMiddlewareFromConfig: vi.fn(() => {
    return (req, res, next) => next();
  })
}));

// Mock dotenv to prevent it from overriding our manual process.env changes
vi.mock('dotenv/config', () => ({}));

describe('index.js', () => {
  let app, server;

  beforeAll(async () => {
    // Set environment before dynamic import
    process.env.PAY_TO = 'G_TEST_ADDRESS';
    const m = await import('../src/index.js');
    app = m.default;
    server = m.server;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mocks config
    mocks.searchError = null;
    if (mocks.db) {
       try { mocks.db.exec('DELETE FROM payments'); } catch(e) {}
    }
    
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (server) await new Promise(r => server.close(r));
  });

  describe('Express Endpoints', () => {
    it('GET / -> returns info payload', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('ClawSearch 402');
    });

    it('GET /.well-known/x402 -> returns x402 discovery', async () => {
      const res = await request(app).get('/.well-known/x402');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('0.2.0');
      expect(res.body.routes.length).toBeGreaterThan(0);
    });

    it('GET /openapi.json -> returns swagger spec', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.1.0');
    });

    it('GET /health -> returns health and stats', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/stats -> returns stats', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalRevenue');
    });

    it('GET /api/recent -> returns recent payments', async () => {
      const res = await request(app).get('/api/recent?limit=10');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/recent without limit -> uses default 50', async () => {
      const res = await request(app).get('/api/recent');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/recent with invalid limit -> falls back to 50', async () => {
      const res = await request(app).get('/api/recent?limit=abc');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    describe('x402 Search endpoints', () => {
      it('GET /search with valid query', async () => {
        // We will encode a fake payment-response header to trigger that code path
        const fakePayment = { payer: 'test_agent', transaction: 'tx_123' };
        const b64 = Buffer.from(JSON.stringify(fakePayment)).toString('base64');
        
        const res = await request(app)
          .get('/search?q=test')
          .set('payment-response', b64);
          
        expect(res.status).toBe(200);
        expect(res.body.query).toBe('test');
        expect(res.body.resultCount).toBe(1);
        expect(res.body.meta.paidUsdc).toBe(0.001);
        expect(res.body.meta.txHash).toBe('tx_123');
      });

      it('GET /search with invalid or missing query', async () => {
        const res = await request(app).get('/search');
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Missing or invalid ?q=');
      });

      it('GET /search when search service throws exception', async () => {
        mocks.searchError = new Error('Upstream failed');
        const res = await request(app).get('/search?q=fail');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Search failed');
        expect(res.body.message).toBe('Upstream failed');
      });

      it('GET /search with invalid payment headers sets agent as unknown', async () => {
        const res = await request(app)
          .get('/search?q=test')
          .set('payment-response', 'invalid_base64_json_!!');
          
        expect(res.status).toBe(200);
        expect(res.body.meta.txHash).toBe('unknown');
      });

      it('GET /search/enriched with valid query', async () => {
        const fakePayment = { payer: 'test_agent', transaction: 'tx_abc' };
        const b64 = Buffer.from(JSON.stringify(fakePayment)).toString('base64');
        
        const res = await request(app)
          .get('/search/enriched?q=enriched')
          .set('payment-response', b64);
          
        expect(res.status).toBe(200);
        expect(res.body.query).toBe('enriched');
        expect(res.body.meta.paidUsdc).toBe(0.005);
      });

      it('GET /search/enriched with invalid or missing query', async () => {
        const res = await request(app).get('/search/enriched');
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Missing or invalid ?q=');
      });

      it('GET /search/enriched with invalid payment headers sets agent as unknown', async () => {
        const res = await request(app)
          .get('/search/enriched?q=test')
          .set('payment-response', 'invalid');
          
        expect(res.status).toBe(200);
        expect(res.body.meta.txHash).toBe('unknown');
      });

      it('GET /search/enriched when search service throws exception', async () => {
        mocks.searchError = new Error('Brave failed');
        const res = await request(app).get('/search/enriched?q=fail');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Search failed');
        expect(res.body.message).toBe('Brave failed');
      });

      it('GET /search with valid json but missing payer and transaction', async () => {
        const fakePayment = { otherKey: 123 };
        const b64 = Buffer.from(JSON.stringify(fakePayment)).toString('base64');
        
        const res = await request(app)
          .get('/search?q=test_missing_fields')
          .set('payment-response', b64);
          
        expect(res.status).toBe(200);
        expect(res.body.meta.txHash).toBe('unknown');
      });

      it('GET /search/enriched with valid json but missing payer and transaction', async () => {
        const fakePayment = { otherKey: 123 };
        const b64 = Buffer.from(JSON.stringify(fakePayment)).toString('base64');
        
        const res = await request(app)
          .get('/search/enriched?q=test_missing_fields')
          .set('payment-response', b64);
          
        expect(res.status).toBe(200);
        expect(res.body.meta.txHash).toBe('unknown');
      });

      it('GET /search with missing payment header but valid query', async () => {
        const res = await request(app).get('/search?q=missing_header');
        expect(res.status).toBe(200);
        expect(res.body.meta.txHash).toBe('unknown');
      });

      it('GET /search/enriched with missing payment header but valid query', async () => {
        const res = await request(app).get('/search/enriched?q=missing_header');
        expect(res.status).toBe(200);
        expect(res.body.meta.txHash).toBe('unknown');
      });
    });
  });
});

