// Compact, reusable Pipeline Health report panel.
// Probes each stage by reading the most recent row from its source table
// and reports status + last successful run time.
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle, Activity, Database, Calculator, Brain, Shield, Zap, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Health = "ok" | "warn" | "down" | "idle";

const STALE_MS = 24 * 60 * 60 * 1000;

const STAGES = [
  { key: "ingestion", name: "Ingestion",  icon: Database },
  { key: "features",  name: "Features",   icon: Calculator },
  { key: "strategy",  name: "Strategy",   icon: Brain },
  { key: "risk",      name: "Risk",       icon: Shield },
  { key: "execution", name: "Execution",  icon: Zap },
  { key: "logging",   name: "Logging",    icon: FileText },
] as const;

const STYLES: Record<Health, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  ok:   { icon: CheckCircle2,  label: "OK",    cls: "text-profit" },
  warn: { icon: AlertTriangle, label: "STALE", cls: "text-warning" },
  down: { icon: XCircle,       label: "DOWN",  cls: "text-loss" },
  idle: { icon: Activity,      label: "IDLE",  cls: "text-muted-foreground" },
};

function classify(ts: string | null, hasUpstream: boolean): Health {
  if (!ts) return hasUpstream ? "down" : "idle";
  return Date.now() - new Date(ts).getTime() > STALE_MS ? "warn" : "ok";
}

async function fetchStages() {
  const [candle, feat, sig, rsig, trade, evt] = await Promise.all([
    supabase.from("candles").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("features").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("signals").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("signals").select("ts").not("approved", "is", null).order("ts", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("trades").select("entry_time").order("entry_time", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("events").select("ts").order("ts", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const cTs = candle.data?.ts ?? null;
  const fTs = feat.data?.ts ?? null;
  const sTs = sig.data?.ts ?? null;
  const rTs = rsig.data?.ts ?? null;
  const tTs = trade.data?.entry_time ?? null;
  const eTs = evt.data?.ts ?? null;

  return {
    ingestion: { ts: cTs, health: classify(cTs, false) },
    features:  { ts: fTs, health: classify(fTs, false) }, // computed in-memory; idle when empty
    strategy:  { ts: sTs, health: classify(sTs, false) },
    risk:      { ts: rTs, health: classify(rTs, false) },
    execution: { ts: tTs, health: classify(tTs, false) },
    logging:   { ts: eTs, health: classify(eTs, !!cTs) },
  } as Record<string, { ts: string | null; health: Health }>;
}

export function PipelineHealthPanel({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-health-panel"],
    queryFn: fetchStages,
    refetchInterval: 20000,
  });

  return (
    <div className="trading-card">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        Pipeline Health
      </h2>
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {STAGES.map((s) => {
          const r = data?.[s.key] ?? { ts: null, health: "idle" as Health };
          const meta = STYLES[r.health];
          const StatusIcon = meta.icon;
          return (
            <div key={s.key} className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{s.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-muted-foreground truncate max-w-[110px]">
                  {r.ts ? formatDistanceToNow(new Date(r.ts), { addSuffix: true }) : "—"}
                </span>
                <span className={cn("inline-flex items-center gap-1 font-mono", meta.cls)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
              </div>
            </div>
          );
        })}
        {isLoading && !data && (
          <p className="text-[10px] text-muted-foreground pt-1">Probing stages…</p>
        )}
      </div>
    </div>
  );
}
