// Pipeline visualization page — shows the architecture flow live.
import { motion } from "framer-motion";
import { Database, Calculator, Brain, Shield, Zap, FileText, RotateCw, ChevronRight, Play, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventLog } from "@/components/EventLog";
import { useCandleCount, useEvents, useRunPipeline, useRunBacktest, useSeedData, useActiveConfig } from "@/hooks/useEngine";
import { cn } from "@/lib/utils";

const stages = [
  { key: 'data', icon: Database, name: 'Data Ingestion', desc: 'Pull, normalize, dedupe candles' },
  { key: 'features', icon: Calculator, name: 'Feature Engineering', desc: 'EMA50/200, RSI14, ATR14' },
  { key: 'strategy', icon: Brain, name: 'Strategy Engine', desc: 'Pluggable signal generation' },
  { key: 'risk', icon: Shield, name: 'Risk Engine', desc: 'Mandatory gate · sizing · kill switch' },
  { key: 'execution', icon: Zap, name: 'Execution Engine', desc: 'Broker abstraction (Paper / MT5)' },
  { key: 'logging', icon: FileText, name: 'Logging & Audit', desc: 'Every step recorded' },
  { key: 'feedback', icon: RotateCw, name: 'Feedback Loop', desc: 'Equity, analytics, performance' },
];

export default function Pipeline() {
  const { data: config } = useActiveConfig();
  const { data: candleCount = 0 } = useCandleCount();
  const { data: events = [] } = useEvents(15);
  const seed = useSeedData();
  const tick = useRunPipeline();
  const backtest = useRunBacktest();

  const ready = candleCount >= 250;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Trading Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Market Data → Features → Strategy → Risk → Execution → Logging → Feedback
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {candleCount.toLocaleString()} candles
          </Badge>
          <Badge variant={config?.kill_switch ? "destructive" : "secondary"} className="font-mono text-xs">
            {config?.kill_switch ? 'KILL SWITCH ON' : (config?.mode?.toUpperCase() ?? 'PAPER')}
          </Badge>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="trading-card">
        <h2 className="text-sm font-semibold mb-4">Architecture Flow</h2>
        <div className="flex flex-wrap items-stretch gap-2">
          {stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1 min-w-[140px]">
              <div className="flex-1 rounded-lg border border-border bg-card/50 p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">{s.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{s.desc}</p>
              </div>
              {i < stages.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        <ControlCard
          title="1. Seed Market Data"
          desc="Generate 1000 mock EURUSD H1 candles into the data engine."
          action="Seed candles"
          loading={seed.isPending}
          done={ready}
          onClick={() => seed.mutate(1000)}
          icon={<Database className="h-5 w-5" />}
        />
        <ControlCard
          title="2. Run Pipeline Tick"
          desc="Execute one full pipeline pass on the latest candle (paper mode)."
          action="Run tick"
          loading={tick.isPending}
          disabled={!ready || config?.kill_switch}
          onClick={() => tick.mutate()}
          icon={<Play className="h-5 w-5" />}
        />
        <ControlCard
          title="3. Run Backtest"
          desc="Replay full candle history through the pipeline. Realistic simulation."
          action="Run backtest"
          loading={backtest.isPending}
          disabled={!ready}
          onClick={() => backtest.mutate(undefined)}
          icon={<RotateCw className="h-5 w-5" />}
        />
      </div>

      {!ready && (
        <div className="trading-card border-warning/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Seed at least 250 candles to enable the pipeline and backtest.
          </p>
        </div>
      )}

      {/* Live event stream */}
      <div className="trading-card">
        <h2 className="text-sm font-semibold mb-4">Live Event Stream</h2>
        <EventLog
          events={(events ?? []).map((e) => ({
            id: String(e.id),
            type: (['info', 'warning', 'error', 'trade', 'signal'].includes(e.type) ? e.type : 'info') as 'info' | 'warning' | 'error' | 'trade' | 'signal',
            message: e.message,
            timestamp: e.ts,
          }))}
        />
      </div>
    </motion.div>
  );
}

function ControlCard(props: {
  title: string; desc: string; action: string; icon: React.ReactNode;
  loading?: boolean; disabled?: boolean; done?: boolean; onClick: () => void;
}) {
  return (
    <div className={cn(
      "trading-card flex flex-col gap-3 transition-colors",
      props.done && "border-profit/30"
    )}>
      <div className="flex items-center gap-2 text-primary">{props.icon}<h3 className="text-sm font-semibold text-foreground">{props.title}</h3></div>
      <p className="text-xs text-muted-foreground flex-1">{props.desc}</p>
      <Button
        size="sm"
        onClick={props.onClick}
        disabled={props.loading || props.disabled}
        variant={props.done ? "outline" : "default"}
      >
        {props.loading ? 'Running…' : props.done ? '✓ Done · Run again' : props.action}
      </Button>
    </div>
  );
}
