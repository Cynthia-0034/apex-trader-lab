// Pipeline Health Check — verifies each stage of the engine is operational
// and reports the last successful run time per stage.
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Activity, Database, Calculator, Brain, Shield, Zap, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Health = "ok" | "warn" | "down" | "idle";

interface StageStatus {
  key: string;
  name: string;
  icon: typeof Database;
  health: Health;
  lastRun: string | null;
  detail: string;
}

const STAGE_META = [
  { key: "ingestion", name: "Data Ingestion", icon: Database },
  { key: "features",  name: "Feature Engineering", icon: Calculator },
  { key: "strategy",  name: "Strategy Engine", icon: Brain },
  { key: "risk",      name: "Risk Engine", icon: Shield },
  { key: "execution", name: "Execution Engine", icon: Zap },
  { key: "logging",   name: "Logging & Audit", icon: FileText },
] as const;

// Staleness threshold (ms) before a stage is marked WARN.
const STALE_MS = 24 * 60 * 60 * 1000;

function classify(ts: string | null, hasActivity: boolean): Health {
  if (!ts) return hasActivity ? "down" : "idle";
  const age = Date.now() - new Date(ts).getTime();
  if (age > STALE_MS) return "warn";
  return "ok";
}

async function fetchHealth(): Promise<StageStatus[]> {
  const [candle, feat, sig, rejSig, trade, evt] = await Promise.all([
    supabase.from("candles").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("features").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("signals").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("signals").select("ts").not("rejection_reason", "is", null).order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("trades").select("entry_time").order("entry_time", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("events").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const candleTs = candle.data?.ts ?? null;
  const featTs = feat.data?.ts ?? null;
  const sigTs = sig.data?.ts ?? null;
  const riskTs = rejSig.data?.ts ?? trade.data?.entry_time ?? null;
  const tradeTs = trade.data?.entry_time ?? null;
  const evtTs = evt.data?.ts ?? null;

  return [
    { key: "ingestion", name: "Data Ingestion", icon: Database,
      health: classify(candleTs, true), lastRun: candleTs,
      detail: candleTs ? "Candles flowing into store" : "No candles ingested yet — seed data" },
    { key: "features", name: "Feature Engineering", icon: Calculator,
      health: classify(featTs, !!candleTs), lastRun: featTs,
      detail: featTs ? "EMA / RSI / ATR computed" : "Awaiting first feature computation" },
    { key: "strategy", name: "Strategy Engine", icon: Brain,
      health: classify(sigTs, !!featTs), lastRun: sigTs,
      detail: sigTs ? "Signals being generated" : "No signals yet — run pipeline" },
    { key: "risk", name: "Risk Engine", icon: Shield,
      health: classify(riskTs, !!sigTs), lastRun: riskTs,
      detail: riskTs ? "Risk gate evaluating signals" : "No risk decisions logged" },
    { key: "execution", name: "Execution Engine", icon: Zap,
      health: classify(tradeTs, false), lastRun: tradeTs,
      detail: tradeTs ? "Broker accepting orders" : "Idle — no executions yet" },
    { key: "logging", name: "Logging & Audit", icon: FileText,
      health: classify(evtTs, true), lastRun: evtTs,
      detail: evtTs ? "Audit trail recording" : "No events recorded" },
  ];
}

const HEALTH_STYLES: Record<Health, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  ok:   { icon: CheckCircle2,   label: "Operational", cls: "text-profit border-profit/30 bg-profit/5" },
  warn: { icon: AlertTriangle,  label: "Stale",       cls: "text-warning border-warning/30 bg-warning/5" },
  down: { icon: XCircle,        label: "Down",        cls: "text-loss border-loss/30 bg-loss/5" },
  idle: { icon: Activity,       label: "Idle",        cls: "text-muted-foreground border-border bg-muted/20" },
};

export default function Health() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: fetchHealth,
    refetchInterval: 15000,
  });

  const stages = data ?? STAGE_META.map((s) => ({
    ...s, health: "idle" as Health, lastRun: null, detail: "Loading…",
  }));

  const okCount = stages.filter((s) => s.health === "ok").length;
  const downCount = stages.filter((s) => s.health === "down").length;
  const overall: Health = downCount > 0 ? "down" : okCount === stages.length ? "ok" : "warn";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Pipeline Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-stage liveness check based on the most recent activity in each layer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("font-mono text-xs", HEALTH_STYLES[overall].cls)}>
            {okCount}/{stages.length} OK
          </Badge>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Checking…" : "Re-check"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {stages.map((s) => {
          const meta = HEALTH_STYLES[s.health];
          const Icon = meta.icon;
          return (
            <div key={s.key} className={cn("rounded-lg border p-4 transition-colors", meta.cls)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <s.icon className="h-5 w-5 shrink-0 text-foreground" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{s.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-mono uppercase">{meta.label}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last successful run</span>
                <span className="font-mono text-foreground">
                  {s.lastRun ? formatDistanceToNow(new Date(s.lastRun), { addSuffix: true }) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Probing pipeline stages…</p>
      )}
    </motion.div>
  );
}
