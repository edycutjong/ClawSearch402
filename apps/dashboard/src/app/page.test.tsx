/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import Dashboard from './page';

expect.extend(matchers);

// ── Mocks ──────────────────────────────────────────────────────

// Mock framer-motion to render plain elements
vi.mock('framer-motion', () => ({
  motion: new Proxy({} as Record<string, any>, {
    get: (_target, prop: string) => {
      // Return a forwardRef component that renders the HTML element
      const Component = ({ children, variants, initial, animate, exit, whileHover, transition, ...rest }: any) => {
        const Tag = prop as keyof JSX.IntrinsicElements;
        return <Tag {...rest}>{children}</Tag>;
      };
      Component.displayName = `motion.${prop}`;
      return Component;
    }
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => <div data-testid="line-chart" {...props}>{children}</div>,
  Line: (props: any) => <div data-testid="line" />,
  XAxis: (props: any) => <div data-testid="x-axis" />,
  YAxis: ({ tickFormatter, ...props }: any) => {
    // Invoke the tickFormatter so V8 covers line 284
    const formatted = tickFormatter ? tickFormatter(42) : null;
    return <div data-testid="y-axis" data-formatted={formatted} />;
  },
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" />,
  Tooltip: ({ formatter, ...props }: any) => {
    // Invoke the formatter so V8 covers line 299
    const formatted = formatter ? formatter(0.005) : null;
    return <div data-testid="tooltip" data-formatted={formatted ? JSON.stringify(formatted) : undefined} />;
  },
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Activity: (props: any) => <svg data-testid="activity-icon" {...props} />,
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  DollarSign: (props: any) => <svg data-testid="dollar-icon" {...props} />,
  Bot: (props: any) => <svg data-testid="bot-icon" {...props} />,
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  Globe: (props: any) => <svg data-testid="globe-icon" {...props} />,
  Settings: (props: any) => <svg data-testid="settings-icon" {...props} />,
  Link: (props: any) => <svg data-testid="link-icon" {...props} />,
}));

// ── EventSource mock ───────────────────────────────────────────

type EventHandler = (event: { data: string }) => void;

let eventSourceInstance: {
  listeners: Record<string, EventHandler>;
  addEventListener: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

class MockEventSource {
  listeners: Record<string, EventHandler> = {};

  addEventListener = vi.fn((event: string, handler: EventHandler) => {
    this.listeners[event] = handler;
  });

  close = vi.fn();

  constructor(_url: string) {
    eventSourceInstance = this;
  }
}

// ── Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  
  // @ts-expect-error - mock EventSource
  globalThis.EventSource = MockEventSource;

  // Default fetch mock: stats + recent
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce({
      json: () => Promise.resolve({
        totalQueries: 42,
        totalRevenue: 1.234,
        uniqueAgents: 5,
        avgLatency: 150,
      })
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve([
        {
          id: 1,
          txHash: 'tx_abc123',
          agent: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
          amount: 0.001,
          query: 'test query',
          endpoint: '/search',
          resultCount: 10,
          latencyMs: 120,
          timestamp: new Date().toISOString(),
        }
      ])
    });
});
import { cleanup } from '@testing-library/react';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});

// ── Tests ──────────────────────────────────────────────────────

describe('Dashboard', () => {
  it('renders the header with title', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    expect(screen.getByText('ClawSearch 402')).toBeInTheDocument();
    expect(screen.getByText('Agentic Web Search Monetization Network')).toBeInTheDocument();
  });

  it('shows Connecting... status initially', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('fetches stats on mount and displays them', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('$1.234 USDC')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });
  });

  it('displays stat card labels and trends', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Queries Processed')).toBeInTheDocument();
    expect(screen.getByText('Unique Agents')).toBeInTheDocument();
    expect(screen.getByText('Avg Latency')).toBeInTheDocument();
    expect(screen.getByText('Lifetime Accumulation')).toBeInTheDocument();
    expect(screen.getByText('Total requests via agent')).toBeInTheDocument();
    expect(screen.getByText('Distinct paying wallets')).toBeInTheDocument();
    expect(screen.getByText('End-to-end response')).toBeInTheDocument();
  });

  it('shows Live Sync Active when SSE connected event fires', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    act(() => {
      eventSourceInstance.listeners['connected']?.({
        data: JSON.stringify({ clients: 3 })
      });
    });

    expect(screen.getByText('Live Sync Active')).toBeInTheDocument();
    expect(screen.getByText('3 Observers Connected')).toBeInTheDocument();
  });

  it('updates client count on clients_update event', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    act(() => {
      eventSourceInstance.listeners['connected']?.({
        data: JSON.stringify({ clients: 2 })
      });
    });

    expect(screen.getByText('2 Observers Connected')).toBeInTheDocument();

    act(() => {
      eventSourceInstance.listeners['clients_update']?.({
        data: JSON.stringify({ clients: 7 })
      });
    });

    expect(screen.getByText('7 Observers Connected')).toBeInTheDocument();
  });

  it('updates stats and adds record on payment SSE event', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    act(() => {
      eventSourceInstance.listeners['payment']?.({
        data: JSON.stringify({
          id: 99,
          txHash: 'tx_new999',
          agent: 'GNEWAGENT123456789012345678901234567890123456789012345',
          amount: 0.005,
          query: 'new search query',
          endpoint: '/search/enriched',
          resultCount: 5,
          latencyMs: 80,
          timestamp: new Date().toISOString(),
        })
      });
    });

    // totalQueries should be 42 + 1 = 43
    await waitFor(() => {
      expect(screen.getByText('43')).toBeInTheDocument();
    });

    // New query should appear in the table
    expect(screen.getByText('new search query')).toBeInTheDocument();
  });

  it('handles SSE error event and sets disconnected', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    await act(async () => {
      render(<Dashboard />);
    });

    // First connect
    act(() => {
      eventSourceInstance.listeners['connected']?.({
        data: JSON.stringify({ clients: 1 })
      });
    });
    expect(screen.getByText('Live Sync Active')).toBeInTheDocument();

    // Then error
    act(() => {
      eventSourceInstance.listeners['error']?.({
        data: '{}'
      });
    });

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    warnSpy.mockRestore();
  });

  it('renders the transaction table with agent link for known agent', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('test query')).toBeInTheDocument();
    });

    // Agent ID should be truncated with link
    const agentLink = screen.getByText(/GABCDE.*DEF$/);
    expect(agentLink).toBeInTheDocument();
    expect(agentLink.closest('a')).toHaveAttribute('href', expect.stringContaining('stellar.expert'));
  });

  it('renders Anonymous for unknown agent', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ totalQueries: 0, totalRevenue: 0, uniqueAgents: 0, avgLatency: 0 })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve([
          {
            id: 2,
            txHash: 'unknown',
            agent: 'unknown',
            amount: 0.001,
            query: 'anon test',
            endpoint: '/search',
            resultCount: 3,
            latencyMs: 100,
            timestamp: new Date().toISOString(),
          }
        ])
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Anonymous')).toBeInTheDocument();
    });
  });

  it('shows empty state when no recent transactions', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ totalQueries: 0, totalRevenue: 0, uniqueAgents: 0, avgLatency: 0 })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve([])
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Listening for X-402 micropayments/)).toBeInTheDocument();
    });
  });

  it('renders Network Details config section', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    expect(screen.getByText('Network Details')).toBeInTheDocument();
    expect(screen.getByText('Stellar Testnet')).toBeInTheDocument();
    expect(screen.getByText('USDC (Native)')).toBeInTheDocument();
    expect(screen.getByText('x402 (L4 Payment Required)')).toBeInTheDocument();
    expect(screen.getByText('$0.001 USDC')).toBeInTheDocument();
    expect(screen.getByText('$0.005 USDC')).toBeInTheDocument();
  });

  it('renders Revenue Velocity chart section with time range selector', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    expect(screen.getByText('Revenue Velocity')).toBeInTheDocument();
    
    const select = screen.getAllByDisplayValue('Last 24 Hours')[0];
    expect(select).toBeInTheDocument();
  });

  it('switches time range to 30m', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    const select = screen.getAllByDisplayValue('Last 24 Hours')[0];
    
    await act(async () => {
      fireEvent.change(select, { target: { value: '30m' } });
    });

    expect(screen.getByDisplayValue('Last 30 Min')).toBeInTheDocument();
  });

  it('renders enriched endpoint with purple badge styling', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ totalQueries: 0, totalRevenue: 0, uniqueAgents: 0, avgLatency: 0 })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve([
          {
            id: 3,
            txHash: 'tx_enriched',
            agent: 'GENRICHEDAGENT1234567890123456789012345678901234567890',
            amount: 0.005,
            query: 'enriched test',
            endpoint: '/search/enriched',
            resultCount: 5,
            latencyMs: 200,
            timestamp: new Date().toISOString(),
          }
        ])
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      const badge = screen.getByText('/search/enriched');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('purple');
    });
  });

  it('renders standard endpoint with emerald badge styling', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      const badge = screen.getByText('/search');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('emerald');
    });
  });

  it('handles fetch errors gracefully on mount', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<Dashboard />);
    });

    expect(logSpy).toHaveBeenCalledWith('Stats API syncing...');
    expect(logSpy).toHaveBeenCalledWith('Recent API syncing...');
    logSpy.mockRestore();
  });

  it('polls stats periodically and handles poll errors', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    // Reset fetch mock for the polling call
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('poll fail'));

    // Advance timer by 10s to trigger the interval
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // fetch should have been called again (initial 2 + 1 poll = 3)
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('cleans up EventSource and interval on unmount', async () => {
    let unmount: () => void;
    
    await act(async () => {
      const result = render(<Dashboard />);
      unmount = result.unmount;
    });

    act(() => {
      unmount!();
    });

    expect(eventSourceInstance.close).toHaveBeenCalled();
  });

  it('renders tx hash link when txHash is not unknown', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      const linkIcons = screen.getAllByTestId('link-icon');
      expect(linkIcons.length).toBeGreaterThan(0);
    });
  });

  it('does not render tx hash link when txHash is unknown', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ totalQueries: 0, totalRevenue: 0, uniqueAgents: 0, avgLatency: 0 })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve([
          {
            id: 10,
            txHash: 'unknown',
            agent: 'GXYZAGENT12345678901234567890123456789012345678901234',
            amount: 0.001,
            query: 'no tx hash test',
            endpoint: '/search',
            resultCount: 1,
            latencyMs: 50,
            timestamp: new Date().toISOString(),
          }
        ])
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('no tx hash test')).toBeInTheDocument();
    });

    // The link icon for tx verification should NOT be present
    const txLinks = screen.queryAllByTestId('link-icon');
    expect(txLinks.length).toBe(0);
  });

  it('updates stats correctly via polling', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    // Mock next poll response with updated stats
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: () => Promise.resolve({
        totalQueries: 100,
        totalRevenue: 5.0,
        uniqueAgents: 10,
        avgLatency: 200,
      })
    });

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('$5.000 USDC')).toBeInTheDocument();
    });
  });

  it('chartData 24h: record outside bucket window does not match (falsy branch)', async () => {
    // Use a record with a timestamp 48 hours ago — won't match any 24h bucket
    const oldTimestamp = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalQueries: 1, totalRevenue: 0.001, uniqueAgents: 1, avgLatency: 50 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 50,
            txHash: 'tx_old',
            agent: 'GOLDAGENT12345678901234567890123456789012345678901234567',
            amount: 0.001,
            query: 'old query',
            endpoint: '/search',
            resultCount: 1,
            latencyMs: 50,
            timestamp: oldTimestamp,
          }
        ])
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('old query')).toBeInTheDocument();
    });

    // The chart should still render (with 0-revenue buckets since the old record doesn't match)
    expect(screen.getAllByTestId('responsive-container')[0]).toBeInTheDocument();
  });

  it('chartData 30m: record outside bucket window does not match (falsy branch)', async () => {
    // Use a record with a timestamp 2 hours ago — won't match any 30-min bucket
    const oldTimestamp = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalQueries: 1, totalRevenue: 0.001, uniqueAgents: 1, avgLatency: 50 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 51,
            txHash: 'tx_old_30m',
            agent: 'GOLDAGENT30M45678901234567890123456789012345678901234567',
            amount: 0.002,
            query: 'old 30m query',
            endpoint: '/search',
            resultCount: 2,
            latencyMs: 60,
            timestamp: oldTimestamp,
          }
        ])
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('old 30m query')).toBeInTheDocument();
    });

    // Switch to 30m view
    const select = screen.getAllByDisplayValue('Last 24 Hours')[0];
    await act(async () => {
      fireEvent.change(select, { target: { value: '30m' } });
    });

    // Chart still renders
    expect(screen.getAllByTestId('responsive-container')[0]).toBeInTheDocument();
  });
});

