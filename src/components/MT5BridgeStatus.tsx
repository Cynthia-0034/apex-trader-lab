import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, CheckCircle2, XCircle, Lock, Loader2, PlayCircle, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Probe = {
  ok: boolean;
  configured: boolean;
  https: boolean;
  bridge_url?: string;
  checked_at: string;
  health?: { ok: boolean; status?: number; latency_ms?: number; error?: string };
  account?: { ok: boolean; balance?: number; equity?: number; currency?: string; login?: string | number; error?: string };
  quote?: { ok: boolean; symbol?: string; bid?: number; ask?: number; spread_pips?: number; error?: string };
  error?: string;
};

export function MT5BridgeStatus() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [loading, setLoading] = useState(false);
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  const runProbe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mt5-bridge-probe', { body: {} });
      if (error) throw error;
      setProbe(data as Probe);
      if ((data as Probe)?.ok) setLastSuccess(new Date().toISOString());
    } catch (e) {
      toast.error(`Bridge probe failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const runDryRun = async () => {
    setDryRunBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('live-dry-run', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const closed = (data?.closed ?? []) as Array<{ pnl: number; reason: string }>;
      if (closed.length) {
        const sumPnl = closed.reduce((s, c) => s + c.pnl, 0).toFixed(2);
        toast.info(`Closed ${closed.length} shadow trade${closed.length > 1 ? 's' : ''} (PnL ${sumPnl})`);
      }
      if (data?.shadow_trade) {
        const tr = data.shadow_trade as { side: string; entry_price: number };
        toast.success(`Shadow ${tr.side} opened @ ${tr.entry_price} — no broker order`);
      } else if (data?.decision && !data.decision.approved) {
        toast.warning(`Signal rejected by risk: ${data.decision.reason}`);
      } else if (data?.warning === 'insufficient_history') {
        toast.message(`Candles backfilling (+${data?.upserted ?? 0}) — run more ticks`);
      } else {
        toast.info(`Live tick OK · no signal · candles +${data?.upserted ?? 0}`);
      }
      if (data?.probe) {
        setProbe(data.probe as Probe);
        if ((data.probe as Probe)?.ok) setLastSuccess(new Date().toISOString());
      }
    } catch (e) {
      toast.error(`Live tick failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDryRunBusy(false);
    }
  };

  useEffect(() => {
    runProbe();
    const id = setInterval(runProbe, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusBadge = !probe
    ? { label: 'Probing…', variant: 'secondary' as const, icon: <Loader2 className="h-3 w-3 animate-spin" /> }
    : !probe.configured
    ? { label: 'Not configured', variant: 'outline' as const, icon: <Lock className="h-3 w-3" /> }
    : probe.ok
    ? { label: 'Connected', variant: 'default' as const, icon: <CheckCircle2 className="h-3 w-3" /> }
    : { label: 'Degraded', variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" /> };

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          MT5 Bridge Status
        </h2>
        <Badge variant={statusBadge.variant} className="font-mono text-xs gap-1.5">
          {statusBadge.icon}
          {statusBadge.label}
        </Badge>
      </div>

      {probe && !probe.configured && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 mb-3 leading-relaxed">
          Add <code className="font-mono text-foreground">MT5_BRIDGE_URL</code> and{' '}
          <code className="font-mono text-foreground">MT5_BRIDGE_TOKEN</code> as Cloud secrets to enable live probes.
          The bridge must expose <code className="font-mono">/health</code>, <code className="font-mono">/account</code>,{' '}
          <code className="font-mono">/quote</code>.
        </div>
      )}

      <div className="space-y-2 text-sm font-mono">
        <Row label="HTTPS" value={probe?.https ? 'yes' : probe?.configured ? 'NO (insecure)' : '—'} ok={probe?.https} />
        <Row
          label="Health"
          value={probe?.health ? (probe.health.ok ? `OK · ${probe.health.latency_ms}ms` : probe.health.error ?? 'fail') : '—'}
          ok={probe?.health?.ok}
        />
        <Row
          label="Account (read-only)"
          value={
            probe?.account?.ok
              ? `${probe.account.balance?.toFixed(2)} ${probe.account.currency ?? ''} · #${probe.account.login ?? '?'}`
              : probe?.account?.error ?? '—'
          }
          ok={probe?.account?.ok}
        />
        <Row
          label="Quote EURUSD"
          value={
            probe?.quote?.ok
              ? `${probe.quote.bid} / ${probe.quote.ask} · ${probe.quote.spread_pips}p`
              : probe?.quote?.error ?? '—'
          }
          ok={probe?.quote?.ok}
        />
        <Row label="Last success" value={lastSuccess ? new Date(lastSuccess).toLocaleTimeString() : '—'} />
        <Row label="Checked" value={probe ? new Date(probe.checked_at).toLocaleTimeString() : '—'} />
      </div>

      <div className="flex gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={runProbe} disabled={loading} className="flex-1">
          {loading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Activity className="h-3 w-3 mr-2" />}
          Test bridge
        </Button>
        <Button size="sm" onClick={runDryRun} disabled={dryRunBusy} className="flex-1">
          {dryRunBusy ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <PlayCircle className="h-3 w-3 mr-2" />}
          Run live tick
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
        Each tick pulls real candles + spread + balance, runs the risk engine, and writes <strong>shadow trades</strong>
        {' '}(<code className="font-mono">mode=shadow</code>) — never sends an order to the broker.
      </p>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const color = ok === true ? 'text-profit' : ok === false ? 'text-loss' : 'text-foreground';
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground text-xs font-sans">{label}</span>
      <span className={`text-xs ${color} truncate max-w-[60%] text-right`}>{value}</span>
    </div>
  );
}
