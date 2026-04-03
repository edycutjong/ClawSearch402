"use client";

import { useEffect, useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
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
  payTo?: string;
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

  useEffect(() => {
    fetch(`${PROXY_URL}/api/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error);

    fetch(`${PROXY_URL}/api/recent?limit=50`)
      .then((res) => res.json())
      .then((data) => setRecent(data))
      .catch(console.error);

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
        const newLatency = (prev.avgLatency * prev.totalQueries + payment.latencyMs) / newTotal;

        return {
          totalQueries: newTotal,
          totalRevenue: prev.totalRevenue + payment.amount,
          uniqueAgents: prev.uniqueAgents,
          avgLatency: newLatency,
        };
      });
    });

    evtSource.addEventListener("error", (e) => {
      console.warn("SSE Error:", e);
      setConnected(false);
    });

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

  const chartData = useMemo(() => {
    if (recent.length === 0) return [];
    
    const buckets: Record<string, number> = {};
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 60000);
      buckets[format(d, "HH:mm")] = 0;
    }
    
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8 relative z-10"
    >
      {/* Header */}
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-sm">
            <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Globe className="text-emerald-400 w-10 h-10" />
            </motion.div>
            ClawSearch 402
          </h1>
          <p className="text-slate-400 mt-2 font-medium tracking-wide">
            Agentic Web Search Monetization Network
          </p>
        </div>
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-md ${
              connected
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${
                connected ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
              }`}
            />
            {connected ? "Live Sync Active" : "Connecting..."}
          </motion.div>
        </div>
      </motion.header>

      {/* Grid Stats */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toFixed(3)} USDC`}
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          trend="Lifetime Accumulation"
        />
        <StatCard
          title="Queries Processed"
          value={stats.totalQueries.toLocaleString()}
          icon={<Search className="w-5 h-5 text-cyan-400" />}
          trend="Total requests via agent"
        />
        <StatCard
          title="Unique Agents"
          value={stats.uniqueAgents.toLocaleString()}
          icon={<Bot className="w-5 h-5 text-indigo-400" />}
          trend="Distinct paying wallets"
        />
        <StatCard
          title="Avg Latency"
          value={`${Math.round(stats.avgLatency)}ms`}
          icon={<Zap className="w-5 h-5 text-amber-400" />}
          trend="End-to-end response"
        />
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-[var(--card)] backdrop-blur-md border border-[var(--border)] rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-cyan-400" />
              Revenue Velocity
            </h2>
            <select className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 font-medium hover:border-emerald-500/50 transition-colors focus:outline-none">
              <option>Last 30 Min</option>
              <option>Last 24 Hours</option>
            </select>
          </div>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.8} vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickMargin={10} 
                  minTickGap={20}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickFormatter={(v) => `$${v}`} 
                  width={60} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    backdropFilter: "blur(8px)",
                    borderColor: "rgba(16, 185, 129, 0.2)",
                    borderRadius: "0.75rem",
                    color: "#f8fafc",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                  }}
                  itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                  formatter={(value: any) => [`$${Number(value).toFixed(3)} USDC`, "Revenue"]}
                  labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 8, fill: "#06b6d4", stroke: "#0f172a", strokeWidth: 3 }}
                  style={{ filter: "drop-shadow(0px 4px 6px rgba(16, 185, 129, 0.3))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Global Configuration */}
        <motion.div variants={itemVariants} className="bg-[var(--card)] backdrop-blur-md border border-[var(--border)] rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50" />
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white relative">
            <Settings className="w-5 h-5 text-emerald-400" />
            Network Details
          </h2>
          <div className="space-y-4 flex-1 relative">
            <ConfigRow label="Network" value="Stellar Testnet" />
            <ConfigRow label="Token" value="USDC (Native)" />
            <ConfigRow label="Protocol" value="x402 (L4 Payment Required)" />
            <ConfigRow label="Search Base Price" value="$0.001 USDC" />
            <ConfigRow label="Enriched Price" value="$0.005 USDC" />
            <ConfigRow label="Node URL" value={PROXY_URL} isCode />
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800/80 relative">
            <p className="text-sm text-cyan-400 font-medium flex items-center gap-3 justify-center">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
              {activeClients} Observers Connected
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Live Transaction Feed */}
      <motion.div variants={itemVariants} className="bg-[var(--card)] backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-[400px]">
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/30 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Activity className="w-5 h-5 text-cyan-400" />
            Live Payment Ledger
          </h2>
          <div className="text-sm font-medium px-3 py-1 bg-slate-800/80 rounded-full text-slate-300 border border-slate-700/50">
            Scanning latest {Math.min(recent.length, 50)} queries
          </div>
        </div>
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Time</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Agent ID (Payer)</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Query Activity</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Route Hit</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Settlement</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center gap-2">
                       <Zap className="w-8 h-8 text-slate-600 mb-2" />
                       Listening for X-402 micropayments...
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {recent.map((record) => (
                    <motion.tr
                      key={record.id}
                      initial={{ opacity: 0, y: -20, backgroundColor: "rgba(16, 185, 129, 0.1)" }}
                      animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="px-6 py-5 text-slate-400 whitespace-nowrap font-medium">
                        {formatDistanceToNow(new Date(record.timestamp), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-5 font-mono text-xs text-cyan-400 whitespace-nowrap">
                        {record.agent !== "unknown" ? (
                          <div className="flex items-center gap-2 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20 w-fit">
                            <Bot className="w-3 h-3" />
                            <a 
                              href={`https://stellar.expert/explorer/testnet/account/${record.agent}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="hover:text-cyan-300 transition-colors"
                            >
                              {record.agent.slice(0, 6)}...{record.agent.slice(-4)}
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">Anonymous</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-white truncate max-w-xs font-semibold">
                        {record.query}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm backdrop-blur-md ${
                          record.endpoint.includes('enriched') 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {record.endpoint}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit">
                          +${record.amount} USDC
                          {record.txHash !== "unknown" && (
                            <a 
                              href={`https://stellar.expert/explorer/testnet/tx/${record.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="opacity-50 hover:opacity-100 transition-opacity"
                              title="Verify on Blockchain"
                            >
                              <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-slate-400 whitespace-nowrap">
                        {record.latencyMs}ms
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
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
    <motion.div 
      variants={{
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
      }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="bg-[var(--card)] backdrop-blur-md border border-[var(--border)] rounded-2xl p-6 shadow-xl transition-all hover:shadow-cyan-500/10 hover:border-slate-600 relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide mb-1 uppercase">{title}</p>
          <h3 className="text-3xl font-extrabold text-white drop-shadow-md tracking-tight">{value}</h3>
          {trend && (
            <p className="text-xs text-cyan-400 mt-2 font-medium bg-cyan-500/10 w-fit px-2 py-0.5 rounded-full border border-cyan-500/20">{trend}</p>
          )}
        </div>
        <div className="p-3 bg-slate-800/80 rounded-xl shadow-inner border border-slate-700/50 group-hover:bg-slate-700/80 transition-colors">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function ConfigRow({ label, value, isCode }: { label: string; value: string; isCode?: boolean }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-800/60 last:border-0 group">
      <span className="text-slate-400 text-sm font-medium transition-colors group-hover:text-slate-300">{label}</span>
      <span className={`text-sm tracking-wide ${
        isCode 
          ? "font-mono text-xs bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-700/50 text-cyan-300" 
          : "text-slate-200 font-semibold"
      }`}>
        {value}
      </span>
    </div>
  );
}
