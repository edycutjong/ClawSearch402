import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.mock('dotenv/config', () => ({}));

describe('index.js (env check)', () => {
  const originalEnv = process.env;
  let exitSpy;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PAY_TO;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('exits if PAY_TO is not set on load', async () => {
    const { server } = await import('../src/index.js');
    expect(exitSpy).toHaveBeenCalledWith(1);
    
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
