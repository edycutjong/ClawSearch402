"use client";

import { useEffect, useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Search,
  DollarSign,
  Bot,
  Zap,
  Globe,
  Settings,
  Link as LinkIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "http://localhost:3001";

interface Stats {
  totalQueries: number;
  totalRevenue: number;
  uniqueAgents: number;
  avgLatency: number;
}

interface PaymentRecord {
  id: number;
  txHash: string;
  agent: string;
  amount: number;
  query: string;
  endpoint: string;
  resultCount: number;
  latencyMs: number;
  timestamp: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalQueries: 0,
    totalRevenue: 0,
    uniqueAgents: 0,
    avgLatency: 0,
  });
  const [recent, setRecent] = useState<PaymentRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeClients, setActiveClients] = useState(0);

  // Initialize data and SSE
  useEffect(() => {
    // Initial fetch
    fetch(`${PROXY_URL}/api/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error);

    fetch(`${PROXY_URL}/api/recent?limit=50`)
      .then((res) => res.json())
      .then((data) => setRecent(data))
      .catch(console.error);

    // Setup SSE
    const evtSource = new EventSource(`${PROXY_URL}/api/events`);

    evtSource.addEventListener("connected", (e) => {
      setConnected(true);
      const data = JSON.parse(e.data);
      setActiveClients(data.clients);
    });

    evtSource.addEventListener("payment", (e) => {
      const payment: PaymentRecord = JSON.parse(e.data);

      setRecent((prev) => [payment, ...prev].slice(0, 100));

      setStats((prev) => {
        const newTotal = prev.totalQueries + 1;
        // Simple moving average approx for latency
        const newLatency = (prev.avgLatency * prev.totalQueries + payment.latencyMs) / newTotal;

        return {
          totalQueries: newTotal,
          totalRevenue: prev.totalRevenue + payment.amount,
          uniqueAgents: prev.uniqueAgents, // Hard to compute delta without set, will refresh eventually
          avgLatency: newLatency,
        };
      });
    });

    evtSource.addEventListener("error", (e) => {
      console.warn("SSE Error:", e);
      setConnected(false);
    });

    // Periodic full refresh for agents count
    const interval = setInterval(() => {
      fetch(`${PROXY_URL}/api/stats`)
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(console.error);
    }, 10000);

    return () => {
      evtSource.close();
      clearInterval(interval);
    };
  }, []);

  // Compute chart data from recent queries (group by minute)
  const chartData = useMemo(() => {
    if (recent.length === 0) return [];
    
    // Create buckets for the last 30 minutes
    const buckets: Record<string, number> = {};
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 60000);
      buckets[format(d, "HH:mm")] = 0;
    }
    
    // Fill buckets
    recent.forEach(r => {
      const key = format(new Date(r.timestamp), "HH:mm");
      if (buckets[key] !== undefined) {
        buckets[key] += r.amount;
      }
    });
    
    return Object.entries(buckets)
      .map(([time, revenue]) => ({ time, revenue }))
      .reverse();
  }, [recent]);

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="text-primary w-8 h-8" />
            ClawSearch 402
          </h1>
          <p className="text-slate-400 mt-1">
            Agentic Web Search Monetization Network
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              connected
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            {connected ? "Live Sync Active" : "Connecting..."}
          </div>
        </div>
      </header>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue (USDC)"
          value={`$${stats.totalRevenue.toFixed(3)}`}
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          trend="Lifetime"
        />
        <StatCard
          title="Queries Processed"
          value={stats.totalQueries.toLocaleString()}
          icon={<Search className="w-5 h-5 text-primary" />}
          trend="Total requests"
        />
        <StatCard
          title="Unique Agents"
          value={stats.uniqueAgents.toLocaleString()}
          icon={<Bot className="w-5 h-5 text-purple-400" />}
          trend="Distinct payers"
        />
        <StatCard
          title="Avg Latency"
          value={`${Math.round(stats.avgLatency)}ms`}
          icon={<Zap className="w-5 h-5 text-amber-400" />}
          trend="End-to-end response"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-400" />
              Revenue Velocity
            </h2>
            <select className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1 text-sm text-slate-300">
              <option>Last 30 Min</option>
              <option>Last 24 Hours</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10} 
                  minTickGap={20}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickFormatter={(v) => `$${v}`} 
                  width={60} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#334155",
                    borderRadius: "0.5rem",
                    color: "#f8fafc",
                  }}
                  itemStyle={{ color: "#10b981" }}
                  formatter={(value: any) => [`$${Number(value).toFixed(3)} USDC`, "Revenue"]}
                  labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Configuration */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm flex flex-col">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-slate-400" />
            Network details
          </h2>
          <div className="space-y-4 flex-1">
            <ConfigRow label="Network" value="Stellar Testnet" />
            <ConfigRow label="Token" value="USDC (Native)" />
            <ConfigRow label="Protocol" value="x402 (L4 Payment Required)" />
            <ConfigRow label="Search Base Price" value="$0.001 USDC" />
            <ConfigRow label="Enriched Price" value="$0.005 USDC" />
            <ConfigRow label="Node URL" value={PROXY_URL} isCode />
          </div>
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400 flex items-center gap-2 justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
              {activeClients} SSE viewers connected
            </p>
          </div>
        </div>
      </div>

      {/* Live Transaction Feed */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
        <div className="p-6 border-b border-[var(--border)] bg-slate-800/50 flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-slate-400" />
            Live Payment Ledger (x402)
          </h2>
          <div className="text-sm text-slate-400">
            Showing latest {Math.min(recent.length, 50)} queries
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Agent ID (Payer)</th>
                <th className="px-6 py-4 font-medium">Query</th>
                <th className="px-6 py-4 font-medium">Endpoint</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Waiting for x402 payments...
                  </td>
                </tr>
              ) : (
                recent.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(record.timestamp))} ago
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-emerald-400 whitespace-nowrap">
                      {record.agent !== "unknown" ? (
                        <a 
                          href={`https://stellar.expert/explorer/testnet/account/${record.agent}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {record.agent.slice(0, 6)}...{record.agent.slice(-4)}
                        </a>
                      ) : (
                        <span className="text-slate-500">Anonymous</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-200 truncate max-w-xs font-medium">
                      "{record.query}"
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs rounded-md ${
                        record.endpoint.includes('enriched') 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {record.endpoint}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                        +${record.amount} USDC
                        {record.txHash !== "unknown" && (
                          <a 
                            href={`https://stellar.expert/explorer/testnet/tx/${record.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            title="View Transaction"
                          >
                            <LinkIcon className="w-3 h-3 text-emerald-600 hover:text-emerald-400" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 whitespace-nowrap">
                      {record.latencyMs}ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm transition-all hover:bg-slate-800/80">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
          {trend && (
            <p className="text-xs text-slate-500 mt-2 font-medium">{trend}</p>
          )}
        </div>
        <div className="p-2.5 bg-slate-800 rounded-lg min-w-10 min-h-10 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value, isCode }: { label: string; value: string; isCode?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${isCode ? "font-mono text-xs bg-slate-800 px-2 py-1 rounded" : "text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}
