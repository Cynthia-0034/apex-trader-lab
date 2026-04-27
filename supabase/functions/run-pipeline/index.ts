// Apex Engine — Live pipeline tick.
// Runs Data → Features → Strategy → Risk → Execution → Logging on the latest candle.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';
import { computeFeatures } from '../_shared/feature_engine.ts';
import { getStrategy } from '../_shared/strategy_engine.ts';
import { evaluateRisk, type RiskState } from '../_shared/risk_engine.ts';
import { PaperBroker } from '../_shared/execution_engine.ts';
import type { Candle, Config } from '../_shared/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: cfgRow } = await supabase.from('configs').select('*').eq('active', true).single();
    if (!cfgRow) throw new Error('No active config');
    const cfg = cfgRow as unknown as Config;

    if (cfg.mode === 'live') {
      return new Response(JSON.stringify({ error: 'Live mode locked. Use paper or backtest.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: candleRows } = await supabase
      .from('candles').select('ts,open,high,low,close,volume,spread')
      .eq('pair', cfg.pair).eq('timeframe', cfg.timeframe)
      .order('ts', { ascending: false }).limit(300);
    if (!candleRows || candleRows.length < 250) throw new Error('Not enough candles');
    const candles: Candle[] = candleRows.reverse().map((r) => ({ ...r, ts: r.ts as string }));

    const features = computeFeatures(candles, cfg);
    const last = features[features.length - 1];
    const prev = features[features.length - 2];
    const strategy = getStrategy(cfg.strategy_key);
    if (!strategy) throw new Error('Strategy not registered');

    // State
    const today = new Date().toISOString().slice(0, 10);
    const { count: dailyCount } = await supabase.from('trades').select('*', { count: 'exact', head: true })
      .gte('entry_time', `${today}T00:00:00Z`);
    const { count: openCount } = await supabase.from('trades').select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    const broker = new PaperBroker();
    const state: RiskState = {
      daily_trade_count: dailyCount ?? 0,
      open_trade_count: openCount ?? 0,
      daily_loss_pct: 0,
      current_spread: broker.spread,
      current_drawdown_pct: 0,
    };

    const signal = strategy.generateSignal(last, prev, cfg);
    const events: { type: string; stage: string; message: string; payload?: Record<string, unknown> }[] = [];

    if (!signal) {
      events.push({ type: 'pipeline', stage: 'strategy', message: 'No signal this bar', payload: { features: last } });
      await supabase.from('events').insert(events);
      return new Response(JSON.stringify({ ok: true, signal: null, features: last }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: sigRow } = await supabase.from('signals').insert({
      ts: signal.ts, pair: signal.pair, timeframe: signal.timeframe,
      strategy_key: signal.strategy_key, side: signal.side,
      confidence: signal.confidence, reason: signal.reason,
    }).select().single();

    const decision = evaluateRisk(signal, last, cfg, state);
    if (!decision.approved) {
      await supabase.from('signals').update({ approved: false, rejection_reason: decision.reason }).eq('id', sigRow!.id);
      await supabase.from('events').insert({
        type: 'risk', stage: 'risk_engine', message: `Signal rejected: ${decision.reason}`,
        signal_id: sigRow!.id, payload: { signal, decision },
      });
      return new Response(JSON.stringify({ ok: true, signal, decision }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fill = await broker.placeOrder({
      pair: cfg.pair, side: signal.side, entry_price: last.close,
      sl_price: decision.sl_price!, tp_price: decision.tp_price!,
      lot_size: decision.position_size!, risk_amount: decision.risk_amount!,
      strategy_key: cfg.strategy_key, timeframe: cfg.timeframe,
    }, last.close, last.ts);

    const { data: tradeRow } = await supabase.from('trades').insert({
      mode: cfg.mode, strategy_key: cfg.strategy_key, pair: cfg.pair, timeframe: cfg.timeframe,
      side: signal.side, entry_price: fill.filled_price,
      stop_loss: decision.sl_price, take_profit: decision.tp_price,
      lot_size: decision.position_size, risk_amount: decision.risk_amount,
      status: 'open', signal_id: sigRow!.id, entry_time: fill.ts,
    }).select().single();

    await supabase.from('signals').update({ approved: true, trade_id: tradeRow!.id }).eq('id', sigRow!.id);
    await supabase.from('events').insert({
      type: 'trade', stage: 'execution',
      message: `${cfg.mode.toUpperCase()} ${signal.side} ${cfg.pair} @ ${fill.filled_price} | SL ${decision.sl_price} TP ${decision.tp_price}`,
      trade_id: tradeRow!.id, signal_id: sigRow!.id,
      payload: { fill, decision },
    });

    return new Response(JSON.stringify({ ok: true, signal, decision, trade: tradeRow }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
