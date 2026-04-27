import { MetricCard } from "@/components/MetricCard";
import { EventLog } from "@/components/EventLog";
import { Badge } from "@/components/ui/badge";
import { Activity, DollarSign, TrendingUp, Shield, BarChart3, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useActiveConfig, useEvents, useLatestBacktest, useTrades } from "@/hooks/useEngine";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function Dashboard() {
  const { data: config } = useActiveConfig();
  const { data: events = [] } = useEvents(8);
  const { data: bt } = useLatestBacktest();
  const { data: trades = [] } = useTrades();

  const openCount = trades.filter((t) => t.status === 'open').length;
  const today = new Date().toISOString().slice(0, 10);
  const dailyCount = trades.filter((t) => t.entry_time.startsWith(today)).length;
  const dailyLoss = Math.max(0, -trades
    .filter((t) => t.entry_time.startsWith(today) && t.pnl !== null)
    .reduce((s, t) => s + Number(t.pnl), 0));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Apex Engine v1 — Trading Research Platform</p>
        </div>
        <Badge className="font-mono text-xs px-3 py-1" variant={config?.kill_switch ? "destructive" : "secondary"}>
          {config?.kill_switch ? "KILL SWITCH ON" : "Systems Normal"}
        </Badge>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Mode" value={config?.mode?.toUpperCase() ?? '—'} subValue="Active config" icon={<Activity className="h-4 w-4" />} />
        <MetricCard
          label="Net P&L (Backtest)"
          value={bt ? `$${Number(bt.net_profit ?? 0).toLocaleString()}` : '—'}
          subValue={bt ? `${bt.total_trades} trades` : 'No backtest yet'}
          variant={Number(bt?.net_profit ?? 0) >= 0 ? 'profit' : 'loss'}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Win Rate"
          value={bt ? `${Number(bt.win_rate ?? 0).toFixed(1)}%` : '—'}
          subValue={bt ? `PF: ${Number(bt.profit_factor ?? 0).toFixed(2)}` : '—'}
          variant="profit"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Max Drawdown"
          value={bt ? `${Number(bt.max_drawdown ?? 0).toFixed(2)}%` : '—'}
          subValue="Within tolerance"
          variant="warning"
          icon={<Shield className="h-4 w-4" />}
        />
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        <motion.div variants={item} className="trading-card md:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Configuration
          </h2>
          <div className="space-y-3 text-sm">
            {config && [
              ['Pair', config.pair],
              ['Timeframe', config.timeframe],
              ['Strategy', config.strategy_key],
              ['Risk / Trade', `${config.risk_per_trade}%`],
              ['Max Daily Trades', String(config.max_daily_trades)],
              ['Max Open', String(config.max_open_trades)],
              ['Max Daily Loss', `${config.max_daily_loss}%`],
              ['R:R Ratio', `1:${config.rr_ratio}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="trading-card md:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Risk Status
          </h2>
          <div className="space-y-4">
            <RiskBar label="Daily Trades" current={dailyCount} max={config?.max_daily_trades ?? 2} />
            <RiskBar label="Open Trades" current={openCount} max={config?.max_open_trades ?? 1} />
            <RiskBar label="Daily Loss %" current={+(dailyLoss / Number(config?.account_balance ?? 10000) * 100).toFixed(2)} max={Number(config?.max_daily_loss ?? 3)} />
          </div>
        </motion.div>

        <motion.div variants={item} className="trading-card md:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Recent Events
          </h2>
          <EventLog
            events={(events ?? []).map((e) => ({
              id: String(e.id),
              type: (['info', 'warning', 'error', 'trade', 'signal'].includes(e.type) ? e.type : 'info') as 'info' | 'warning' | 'error' | 'trade' | 'signal',
              message: e.message,
              timestamp: e.ts,
            }))}
            maxItems={6}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

function RiskBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min((current / max) * 100, 100);
  const danger = pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{current} / {max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all ${danger ? 'bg-loss' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
