// Live Dry-Run — probe MT5 bridge + run strategy, write SHADOW signals only.
// Zero orders. Zero trades. Safe to run on an interval.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';
import { computeFeatures } from '../run-pipeline/_lib/feature_engine.ts';
import { getStrategy } from '../run-pipeline/_lib/strategy_engine.ts';
import type { Candle, Config } from '../run-pipeline/_lib/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Probe bridge (read-only).
    const { data: probe } = await supabase.functions.invoke('mt5-bridge-probe', { body: {} });

    // 2. Pull active config + recent candles.
    const { data: cfgRow } = await supabase.from('configs').select('*').eq('active', true).single();
    if (!cfgRow) throw new Error('No active config');
    const cfg = cfgRow as unknown as Config;

    const { data: candleRows } = await supabase
      .from('candles').select('ts,open,high,low,close,volume,spread')
      .eq('pair', cfg.pair).eq('timeframe', cfg.timeframe)
      .order('ts', { ascending: false }).limit(300);

    let shadow_signal: Record<string, unknown> | null = null;

    if (candleRows && candleRows.length >= 250) {
      const candles: Candle[] = candleRows.reverse().map((r) => ({ ...r, ts: r.ts as string }));
      const features = computeFeatures(candles, cfg);
      const last = features[features.length - 1];
      const prev = features[features.length - 2];
      const strategy = getStrategy(cfg.strategy_key);
      const signal = strategy?.generateSignal(last, prev, cfg);

      if (signal) {
        // Write shadow signal — approved=null, no trade_id, reason tagged dry_run.
        const { data: sigRow } = await supabase.from('signals').insert({
          ts: signal.ts,
          pair: signal.pair,
          timeframe: signal.timeframe,
          strategy_key: signal.strategy_key,
          side: signal.side,
          confidence: signal.confidence,
          reason: { ...signal.reason, dry_run: true, bridge_ok: probe?.ok ?? false },
        }).select().single();
        shadow_signal = sigRow as Record<string, unknown> | null;

        await supabase.from('events').insert({
          type: 'signal',
          stage: 'dry_run',
          message: `DRY-RUN ${signal.side} ${cfg.pair} @ ${last.close} (no order placed)`,
          signal_id: sigRow?.id,
          payload: { signal, probe, last_features: last },
        });
      } else {
        await supabase.from('events').insert({
          type: 'info',
          stage: 'dry_run',
          message: 'DRY-RUN: no signal this bar',
          payload: { probe, last_features: last },
        });
      }
    } else {
      await supabase.from('events').insert({
        type: 'warning',
        stage: 'dry_run',
        message: 'DRY-RUN: insufficient candle history, skipping strategy',
        payload: { probe, candles: candleRows?.length ?? 0 },
      });
    }

    return new Response(JSON.stringify({ ok: true, probe, shadow_signal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
