import { MetricCard } from "@/components/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, AlertTriangle, Target, Activity, Inbox, Play } from "lucide-react";
import { CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, XAxis, YAxis } from "recharts";
import { useLatestBacktest, useRunBacktest } from "@/hooks/useEngine";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function Backtests() {
  const { data: bt, isLoading } = useLatestBacktest();
  const run = useRunBacktest();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Backtest Results
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{bt?.name ?? 'No backtest yet'}</p>
        </div>
        <div className="flex items-center gap-2">
          {bt && (
            <Badge variant="secondary" className="font-mono text-xs">
              {new Date(bt.start_date).toLocaleDateString()} → {new Date(bt.end_date).toLocaleDateString()}
            </Badge>
          )}
          <Button size="sm" onClick={() => run.mutate(undefined)} disabled={run.isPending}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {run.isPending ? 'Running…' : 'Run new backtest'}
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !bt ? (
        <div className="trading-card flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Inbox className="h-10 w-10" />
          <p className="text-sm">No backtests yet. Seed market data and run one from the Pipeline page.</p>
        </div>
      ) : (
        <>
          <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Trades" value={String(bt.total_trades)} icon={<Activity className="h-4 w-4" />} />
            <MetricCard label="Win Rate" value={`${Number(bt.win_rate ?? 0).toFixed(1)}%`} variant="profit" icon={<Target className="h-4 w-4" />} />
            <MetricCard label="Profit Factor" value={String(Number(bt.profit_factor ?? 0).toFixed(2))} variant="profit" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Max Drawdown" value={`${Number(bt.max_drawdown ?? 0).toFixed(2)}%`} variant="warning" icon={<AlertTriangle className="h-4 w-4" />} />
            <MetricCard label="Net Profit" value={`$${Number(bt.net_profit ?? 0).toLocaleString()}`} variant={Number(bt.net_profit ?? 0) >= 0 ? 'profit' : 'loss'} icon={<DollarSign className="h-4 w-4" />} />
            <MetricCard label="Sharpe" value={String(Number(bt.sharpe_ratio ?? 0).toFixed(2))} icon={<BarChart3 className="h-4 w-4" />} />
          </motion.div>

          <motion.div variants={item} className="trading-card">
            <h2 className="text-sm font-semibold mb-4">Equity Curve</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(bt.equity_curve as { ts: string; equity: number }[]) ?? []}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                  <XAxis dataKey="ts" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 52%)' }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 52%)' }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} domain={['dataMin - 100', 'dataMax + 100']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 14%, 18%)', borderRadius: '8px', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                    labelStyle={{ color: 'hsl(215, 15%, 52%)' }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, 'Equity']}
                  />
                  <Area type="monotone" dataKey="equity" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#equityGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
