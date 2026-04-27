import { useActiveConfig, useEvents, useToggleKillSwitch, useTrades } from "@/hooks/useEngine";
import { EventLog } from "@/components/EventLog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldOff, AlertTriangle, CheckCircle, XCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function Safety() {
  const { data: config } = useActiveConfig();
  const { data: events = [] } = useEvents(20);
  const { data: trades = [] } = useTrades();
  const toggle = useToggleKillSwitch();

  const killSwitch = !!config?.kill_switch;
  const today = new Date().toISOString().slice(0, 10);
  const dailyCount = trades.filter((t) => t.entry_time.startsWith(today)).length;
  const openCount = trades.filter((t) => t.status === 'open').length;
  const closedCount = trades.filter((t) => t.status === 'closed').length;

  if (!config) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const checks = [
    { label: 'Kill Switch OFF', ok: !killSwitch, critical: true },
    { label: `Daily trades < ${config.max_daily_trades}`, ok: dailyCount < config.max_daily_trades },
    { label: `Open trades < ${config.max_open_trades}`, ok: openCount < config.max_open_trades },
    { label: `Paper trading history ≥ 30 trades`, ok: closedCount >= 30 },
    { label: 'MT5 broker connected', ok: false, critical: true },
    { label: 'Admin key verified', ok: false, critical: true },
  ];
  const allClear = checks.every((c) => c.ok);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Safety & Risk Controls
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Master kill switch, risk limits, and live trading prerequisites.</p>
      </motion.div>

      <motion.div
        variants={item}
        className={cn("trading-card border-2", killSwitch ? "border-loss/50" : "border-border")}
        style={killSwitch ? { boxShadow: '0 0 20px hsl(0 84% 60% / 0.2)' } : {}}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {killSwitch ? <ShieldOff className="h-8 w-8 text-loss" /> : <ShieldCheck className="h-8 w-8 text-profit" />}
            <div>
              <h2 className="text-lg font-bold">Kill Switch — {killSwitch ? "ACTIVATED" : "OFF"}</h2>
              <p className="text-sm text-muted-foreground">
                {killSwitch ? "All trading is halted. Risk engine will reject every signal." : "Trading systems are operational."}
              </p>
            </div>
          </div>
          <Switch checked={killSwitch} onCheckedChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} className="scale-125" />
        </div>
      </motion.div>

      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Risk Limits (Active Config)
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            ['Risk per Trade', `${config.risk_per_trade}%`],
            ['Max Daily Trades', `${dailyCount}/${config.max_daily_trades}`],
            ['Max Open Trades', `${openCount}/${config.max_open_trades}`],
            ['Max Daily Loss', `${config.max_daily_loss}%`],
            ['Spread Threshold', `${config.spread_threshold} pips`],
            ['ATR Range', `${config.atr_min} — ${config.atr_max}`],
            ['Cooldown', `${config.cooldown_minutes} min`],
            ['Drawdown Circuit Breaker', `${config.drawdown_circuit_breaker}%`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="font-mono text-sm text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item} className="trading-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Live Trading Prerequisites
          </h2>
          <Badge variant={allClear ? "default" : "destructive"} className="font-mono text-xs">{allClear ? "READY" : "NOT READY"}</Badge>
        </div>
        <div className="space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              {c.ok ? <CheckCircle className="h-4 w-4 text-profit shrink-0" />
                : <XCircle className={cn("h-4 w-4 shrink-0", c.critical ? "text-loss" : "text-warning")} />}
              <span className={cn("text-sm", c.ok ? "text-muted-foreground" : "text-foreground")}>{c.label}</span>
              {c.critical && !c.ok && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item} className="trading-card border-warning/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-warning">Disclaimer</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              This software is for educational and research purposes only. Trading involves financial risk.
              No guarantee of profit is provided. Past performance does not indicate future results.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4">System Audit Log</h2>
        <EventLog
          events={(events ?? []).map((e) => ({
            id: String(e.id),
            type: (['info', 'warning', 'error', 'trade', 'signal'].includes(e.type) ? e.type : 'info') as 'info' | 'warning' | 'error' | 'trade' | 'signal',
            message: e.message,
            timestamp: e.ts,
          }))}
        />
      </motion.div>
    </motion.div>
  );
}
