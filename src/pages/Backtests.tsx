import { mockBacktest } from "@/lib/mockData";
import { MetricCard } from "@/components/MetricCard";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, AlertTriangle, Target, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Backtests() {
  const bt = mockBacktest;
  const recentTrades = bt.trades.slice(0, 15);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Backtest Results
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{bt.name}</p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {bt.startDate} → {bt.endDate}
        </Badge>
      </motion.div>

      {/* Metrics */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Trades" value={String(bt.totalTrades)} icon={<Activity className="h-4 w-4" />} />
        <MetricCard label="Win Rate" value={`${bt.winRate}%`} variant="profit" icon={<Target className="h-4 w-4" />} />
        <MetricCard label="Profit Factor" value={String(bt.profitFactor)} variant="profit" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Max Drawdown" value={`${bt.maxDrawdown}%`} variant="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <MetricCard label="Net Profit" value={`$${bt.netProfit.toLocaleString()}`} variant="profit" icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard label="Sharpe Ratio" value={String(bt.sharpeRatio)} icon={<BarChart3 className="h-4 w-4" />} />
      </motion.div>

      {/* Equity Curve */}
      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4">Equity Curve</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bt.equityCurve}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 52%)' }}
                tickFormatter={(v) => v.slice(5)}
                interval={29}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 52%)' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                domain={['dataMin - 200', 'dataMax + 200']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 10%)',
                  border: '1px solid hsl(220, 14%, 18%)',
                  borderRadius: '8px',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                }}
                labelStyle={{ color: 'hsl(215, 15%, 52%)' }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'Equity']}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fill="url(#equityGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Trade History */}
      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4">Trade History (Last 15)</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">ID</TableHead>
                <TableHead className="font-mono text-xs">Dir</TableHead>
                <TableHead className="font-mono text-xs">Entry</TableHead>
                <TableHead className="font-mono text-xs">Exit</TableHead>
                <TableHead className="font-mono text-xs">SL</TableHead>
                <TableHead className="font-mono text-xs">TP</TableHead>
                <TableHead className="font-mono text-xs">Pips</TableHead>
                <TableHead className="font-mono text-xs">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.map((t) => (
                <TableRow key={t.id} className="hover:bg-accent/30">
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell>
                    <Badge variant={t.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] font-mono">
                      {t.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.entryPrice}</TableCell>
                  <TableCell className="font-mono text-xs">{t.exitPrice}</TableCell>
                  <TableCell className="font-mono text-xs">{t.stopLoss}</TableCell>
                  <TableCell className="font-mono text-xs">{t.takeProfit}</TableCell>
                  <TableCell className={cn("font-mono text-xs", (t.pnlPips ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                    {(t.pnlPips ?? 0) >= 0 ? '+' : ''}{t.pnlPips}
                  </TableCell>
                  <TableCell className={cn("font-mono text-xs font-medium", (t.pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                    {(t.pnl ?? 0) >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </motion.div>
  );
}
