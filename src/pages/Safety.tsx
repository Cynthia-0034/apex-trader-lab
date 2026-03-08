import { useState } from "react";
import { mockRiskStatus, mockConfig, mockEvents } from "@/lib/mockData";
import { EventLog } from "@/components/EventLog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldOff, AlertTriangle, CheckCircle, XCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Safety() {
  const [killSwitch, setKillSwitch] = useState(mockRiskStatus.killSwitch);

  const checks = [
    { label: 'Kill Switch OFF', ok: !killSwitch, critical: true },
    { label: `Daily trades < ${mockConfig.maxDailyTrades}`, ok: mockRiskStatus.dailyTradeCount < mockConfig.maxDailyTrades },
    { label: `Open trades < ${mockConfig.maxOpenTrades}`, ok: mockRiskStatus.openTradeCount < mockConfig.maxOpenTrades },
    { label: `Daily loss < ${mockConfig.maxDailyLoss}%`, ok: mockRiskStatus.dailyLoss < mockConfig.maxDailyLoss },
    { label: 'Spread within threshold', ok: mockRiskStatus.spreadOk },
    { label: 'ATR within range', ok: mockRiskStatus.atrOk },
    { label: 'Paper trading history ≥ 30 trades', ok: true },
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
        <p className="text-sm text-muted-foreground mt-1">
          Manage risk parameters, kill switch, and live trading prerequisites.
        </p>
      </motion.div>

      {/* Kill Switch */}
      <motion.div
        variants={item}
        className={cn(
          "trading-card border-2",
          killSwitch ? "border-loss/50 glow-border" : "border-border"
        )}
        style={killSwitch ? { boxShadow: '0 0 20px hsl(0 84% 60% / 0.2)' } : {}}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {killSwitch ? (
              <ShieldOff className="h-8 w-8 text-loss" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-profit" />
            )}
            <div>
              <h2 className="text-lg font-bold">
                Kill Switch — {killSwitch ? "ACTIVATED" : "OFF"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {killSwitch
                  ? "All trading is halted. No new positions will be opened."
                  : "Trading systems are operational."}
              </p>
            </div>
          </div>
          <Switch
            checked={killSwitch}
            onCheckedChange={setKillSwitch}
            className="scale-125"
          />
        </div>
      </motion.div>

      {/* Risk Limits */}
      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Risk Limits
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Risk per Trade', value: `${mockConfig.riskPerTrade}%`, status: 'ok' },
            { label: 'Max Daily Trades', value: `${mockRiskStatus.dailyTradeCount}/${mockConfig.maxDailyTrades}`, status: mockRiskStatus.dailyTradeCount >= mockConfig.maxDailyTrades ? 'warn' : 'ok' },
            { label: 'Max Open Trades', value: `${mockRiskStatus.openTradeCount}/${mockConfig.maxOpenTrades}`, status: 'ok' },
            { label: 'Max Daily Loss', value: `${mockRiskStatus.dailyLoss}% / ${mockConfig.maxDailyLoss}%`, status: mockRiskStatus.dailyLoss >= mockConfig.maxDailyLoss * 0.8 ? 'warn' : 'ok' },
            { label: 'Spread Threshold', value: `${mockConfig.spreadThreshold} pips`, status: mockRiskStatus.spreadOk ? 'ok' : 'warn' },
            { label: 'ATR Range', value: `${mockConfig.atrMin} — ${mockConfig.atrMax}`, status: mockRiskStatus.atrOk ? 'ok' : 'warn' },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className={cn(
                "font-mono text-sm",
                r.status === 'ok' ? 'text-foreground' : 'text-warning'
              )}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live Trading Checklist */}
      <motion.div variants={item} className="trading-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Live Trading Prerequisites
          </h2>
          <Badge variant={allClear ? "default" : "destructive"} className="font-mono text-xs">
            {allClear ? "READY" : "NOT READY"}
          </Badge>
        </div>
        <div className="space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              {c.ok ? (
                <CheckCircle className="h-4 w-4 text-profit shrink-0" />
              ) : (
                <XCircle className={cn("h-4 w-4 shrink-0", c.critical ? "text-loss" : "text-warning")} />
              )}
              <span className={cn("text-sm", c.ok ? "text-muted-foreground" : "text-foreground")}>
                {c.label}
              </span>
              {c.critical && !c.ok && (
                <Badge variant="destructive" className="text-[10px]">Required</Badge>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Disclaimer */}
      <motion.div variants={item} className="trading-card border-warning/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-warning">Disclaimer</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              This software is for educational and research purposes only. Trading involves financial risk.
              No guarantee of profit is provided. Past performance does not indicate future results.
              Always use proper risk management and never trade with money you cannot afford to lose.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Events */}
      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4">System Audit Log</h2>
        <EventLog events={mockEvents} />
      </motion.div>
    </motion.div>
  );
}
