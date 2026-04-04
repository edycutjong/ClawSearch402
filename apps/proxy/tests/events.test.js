import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

vi.useFakeTimers();

import { sseHandler, emitPaymentEvent, getClientCount } from '../src/events.js';

describe('events.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const createMockClient = () => {
    const reqHandlers = {};
    const req = {
      on: vi.fn((event, handler) => {
        reqHandlers[event] = handler;
      })
    };
    const res = {
      writeHead: vi.fn(),
      write: vi.fn()
    };
    return { req, res, reqHandlers };
  };

  it('handles client connection correctly', () => {
    const { req, res } = createMockClient();
    
    // Initial state should depend on active clients. But since module state is shared,
    // let's just make sure it writes the headers and initial event.
    const initialCount = getClientCount();
    
    sseHandler(req, res);
    
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: connected'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: clients_update'));
    
    expect(getClientCount()).toBe(initialCount + 1);
  });

  it('cleans up client on disconnect', () => {
    const { req, res, reqHandlers } = createMockClient();
    
    sseHandler(req, res);
    const countAfterConnect = getClientCount();
    
    // Simulate close event
    reqHandlers['close']();
    
    expect(getClientCount()).toBe(countAfterConnect - 1);
    // Should broadcast disconnect
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: clients_update'));
  });

  it('sends heartbeat every 30s', () => {
    const { req, res } = createMockClient();
    sseHandler(req, res);
    
    res.write.mockClear();
    
    vi.advanceTimersByTime(30000);
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: heartbeat'));
    expect(res.write).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(30000);
    expect(res.write).toHaveBeenCalledTimes(2);
  });

  it('emits payment event to all clients', () => {
    const { req: req1, res: res1 } = createMockClient();
    const { req: req2, res: res2 } = createMockClient();
    
    sseHandler(req1, res1);
    sseHandler(req2, res2);
    
    res1.write.mockClear();
    res2.write.mockClear();
    
    const payment = { amount: 10, agent: 'abcd1234xxx', query: 'cats' };
    emitPaymentEvent(payment);
    
    expect(res1.write).toHaveBeenCalledWith(expect.stringContaining('event: payment'));
    expect(res1.write).toHaveBeenCalledWith(expect.stringContaining('cats'));
    
    expect(res2.write).toHaveBeenCalledWith(expect.stringContaining('event: payment'));
  });

  it('removes client if write fails during payment emit', () => {
    const { req, res } = createMockClient();
    sseHandler(req, res);
    
    // Make write throw an error
    res.write.mockImplementationOnce(() => {
      throw new Error('Write failed');
    });
    
    // Should swallow error and remove client
    const countBefore = getClientCount();
    emitPaymentEvent({ amount: 5, agent: 'test', query: 'throw' });
    
    expect(getClientCount()).toBe(countBefore - 1);
  });

});
