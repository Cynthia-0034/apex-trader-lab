import { MetricCard } from "@/components/MetricCard";
import { EventLog } from "@/components/EventLog";
import { mockEvents, mockRiskStatus, mockConfig, mockBacktest } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { Activity, DollarSign, TrendingUp, Shield, BarChart3, Clock } from "lucide-react";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Dashboard() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Apex Engine v1 — Trading Research Platform</p>
        </div>
        <Badge
          className="font-mono text-xs px-3 py-1"
          variant={mockRiskStatus.killSwitch ? "destructive" : "secondary"}
        >
          {mockRiskStatus.killSwitch ? "KILL SWITCH ON" : "Systems Normal"}
        </Badge>
      </motion.div>

      {/* Metrics */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Mode"
          value="Paper"
          subValue="Simulated trading"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Net P&L (Backtest)"
          value={`$${mockBacktest.netProfit.toLocaleString()}`}
          subValue={`${mockBacktest.totalTrades} trades`}
          variant="profit"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Win Rate"
          value={`${mockBacktest.winRate}%`}
          subValue={`PF: ${mockBacktest.profitFactor}`}
          variant="profit"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${mockBacktest.maxDrawdown}%`}
          subValue="Within tolerance"
          variant="warning"
          icon={<Shield className="h-4 w-4" />}
        />
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Config Summary */}
        <motion.div variants={item} className="trading-card md:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Configuration
          </h2>
          <div className="space-y-3 text-sm">
            {[
              ['Platform', mockConfig.platform],
              ['Pair', mockConfig.pair],
              ['Timeframe', mockConfig.timeframe],
              ['Risk / Trade', `${mockConfig.riskPerTrade}%`],
              ['Max Daily Trades', String(mockConfig.maxDailyTrades)],
              ['Max Open', String(mockConfig.maxOpenTrades)],
              ['Max Daily Loss', `${mockConfig.maxDailyLoss}%`],
              ['R:R Ratio', `1:${mockConfig.rrRatio}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Risk Gauges */}
        <motion.div variants={item} className="trading-card md:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Risk Status
          </h2>
          <div className="space-y-4">
            <RiskBar label="Daily Trades" current={mockRiskStatus.dailyTradeCount} max={mockRiskStatus.maxDailyTrades} />
            <RiskBar label="Open Trades" current={mockRiskStatus.openTradeCount} max={mockRiskStatus.maxOpenTrades} />
            <RiskBar label="Daily Loss %" current={mockRiskStatus.dailyLoss} max={mockRiskStatus.maxDailyLoss} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Spread Filter</span>
              <span className={mockRiskStatus.spreadOk ? "text-profit" : "text-loss"}>
                {mockRiskStatus.spreadOk ? "OK" : "BLOCKED"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ATR Filter</span>
              <span className={mockRiskStatus.atrOk ? "text-profit" : "text-loss"}>
                {mockRiskStatus.atrOk ? "OK" : "BLOCKED"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Events */}
        <motion.div variants={item} className="trading-card md:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Recent Events
          </h2>
          <EventLog events={mockEvents} maxItems={6} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function RiskBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = Math.min((current / max) * 100, 100);
  const danger = pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${danger ? 'bg-loss' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
