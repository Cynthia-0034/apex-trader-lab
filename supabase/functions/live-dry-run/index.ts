// Live Dry-Run — pulls REAL data from MT5 bridge, runs the full pipeline,
// writes SHADOW trades (mode='shadow') with no broker submission.
//
// Pipeline per tick:
//   1. Probe bridge (/health, /account, /quote, /candles)
//   2. Upsert real candles into public.candles with source='mt5'
//   3. Manage open shadow trades — close on SL/TP using the live mid price
//   4. Compute features + generate signal
//   5. Risk gate (using REAL spread + REAL account balance)
//   6. If approved → write shadow trade + shadow signal (NO order placed)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';
import { computeFeatures } from './_lib/feature_engine.ts';
import { getStrategy } from './_lib/strategy_engine.ts';
import { evaluateRisk, type RiskState } from './_lib/risk_engine.ts';
import type { Candle, Config } from './_lib/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type BridgeQuote = { ok: boolean; bid?: number; ask?: number; spread_pips?: number; error?: string };
type BridgeAccount = { ok: boolean; balance?: number; equity?: number; currency?: string; login?: string | number; error?: string };

async function bridgeFetch(base: string, token: string, path: string, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const bridgeUrl = Deno.env.get('MT5_BRIDGE_URL');
    const bridgeToken = Deno.env.get('MT5_BRIDGE_TOKEN');

    if (!bridgeUrl || !bridgeToken) {
      await supabase.from('events').insert({
        type: 'warning', stage: 'dry_run',
        message: 'DRY-RUN aborted: MT5_BRIDGE_URL / MT5_BRIDGE_TOKEN not configured',
        payload: { configured: false },
      });
      return new Response(JSON.stringify({
        ok: false, configured: false,
        error: 'MT5 bridge not configured. Add MT5_BRIDGE_URL and MT5_BRIDGE_TOKEN secrets.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const base = bridgeUrl.replace(/\/$/, '');

    // 1. Probe bridge (delegated to dedicated function for unified audit trail).
    const { data: probe } = await supabase.functions.invoke('mt5-bridge-probe', { body: {} });
    if (!probe?.ok) {
      return new Response(JSON.stringify({ ok: false, probe, error: 'Bridge probe failed — see probe payload' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load active config.
    const { data: cfgRow } = await supabase.from('configs').select('*').eq('active', true).single();
    if (!cfgRow) throw new Error('No active config');
    const cfg = cfgRow as unknown as Config;

    // 3. Read real account + quote.
    const accRes = await bridgeFetch(base, bridgeToken, '/account');
    const account = (accRes.ok ? { ok: true, ...accRes.body } : { ok: false, error: accRes.body?.error }) as BridgeAccount;
    const qRes = await bridgeFetch(base, bridgeToken, `/quote?symbol=${encodeURIComponent(cfg.pair)}`);
    const quote = (qRes.ok && typeof qRes.body.bid === 'number'
      ? { ok: true, bid: qRes.body.bid, ask: qRes.body.ask, spread_pips: +(((qRes.body.ask - qRes.body.bid) * 10000)).toFixed(2) }
      : { ok: false, error: qRes.body?.error ?? qRes.status }) as BridgeQuote;

    if (!account.ok || !quote.ok) {
      throw new Error(`Bridge data incomplete: account=${account.ok} quote=${quote.ok}`);
    }
    const mid = ((quote.bid! + quote.ask!) / 2);

    // 4. Pull recent candles from the bridge & upsert (source='mt5').
    const cRes = await bridgeFetch(base, bridgeToken,
      `/candles?symbol=${encodeURIComponent(cfg.pair)}&timeframe=${encodeURIComponent(cfg.timeframe)}&count=500`);
    let upserted = 0;
    if (cRes.ok && Array.isArray(cRes.body?.candles)) {
      const rows = cRes.body.candles
        .filter((c: { ts: string; open: number; high: number; low: number; close: number }) =>
          c?.ts && typeof c.close === 'number')
        .map((c: { ts: string; open: number; high: number; low: number; close: number; volume?: number; spread?: number }) => ({
          pair: cfg.pair, timeframe: cfg.timeframe, source: 'mt5',
          ts: c.ts, open: c.open, high: c.high, low: c.low, close: c.close,
          volume: c.volume ?? 0, spread: c.spread ?? null,
        }));
      if (rows.length) {
        // Insert ignoring duplicates by (pair,timeframe,ts). No unique constraint in schema,
        // so we de-dupe against what's already there for this batch's window.
        const oldest = rows[0].ts;
        const { data: existing } = await supabase
          .from('candles').select('ts')
          .eq('pair', cfg.pair).eq('timeframe', cfg.timeframe).gte('ts', oldest);
        const have = new Set((existing ?? []).map((r) => new Date(r.ts as string).toISOString()));
        const fresh = rows.filter((r) => !have.has(new Date(r.ts).toISOString()));
        if (fresh.length) {
          const { error: insErr } = await supabase.from('candles').insert(fresh);
          if (!insErr) upserted = fresh.length;
        }
      }
    }

    // 5. Manage open SHADOW trades — close on SL/TP using live mid price.
    const closed: Array<{ id: string; pnl: number; reason: string }> = [];
    const { data: openShadow } = await supabase
      .from('trades').select('*').eq('mode', 'shadow').eq('status', 'open');
    for (const t of openShadow ?? []) {
      const sl = Number(t.stop_loss), tp = Number(t.take_profit), entry = Number(t.entry_price);
      const lot = Number(t.lot_size);
      let exit: number | null = null, reason = '';
      if (t.side === 'LONG') {
        if (quote.bid! <= sl) { exit = sl; reason = 'sl_hit'; }
        else if (quote.bid! >= tp) { exit = tp; reason = 'tp_hit'; }
      } else {
        if (quote.ask! >= sl) { exit = sl; reason = 'sl_hit'; }
        else if (quote.ask! <= tp) { exit = tp; reason = 'tp_hit'; }
      }
      if (exit !== null) {
        const pips = t.side === 'LONG' ? (exit - entry) * 10000 : (entry - exit) * 10000;
        const pnl = +(pips * 10 * lot).toFixed(2);
        const r_multiple = +((exit - entry) / (entry - sl)).toFixed(2) * (t.side === 'LONG' ? 1 : -1);
        await supabase.from('trades').update({
          status: 'closed', exit_price: exit, exit_time: new Date().toISOString(),
          pnl, pnl_pips: +pips.toFixed(1), r_multiple, close_reason: reason,
        }).eq('id', t.id);
        await supabase.from('events').insert({
          type: 'trade', stage: 'shadow_close', trade_id: t.id,
          message: `SHADOW ${t.side} ${cfg.pair} closed @ ${exit} (${reason}) PnL ${pnl}`,
          payload: { exit, reason, pnl, live_quote: quote },
        });
        closed.push({ id: t.id, pnl, reason });
      }
    }

    // 6. Compute features + run strategy on the latest history.
    const { data: candleRows } = await supabase
      .from('candles').select('ts,open,high,low,close,volume,spread')
      .eq('pair', cfg.pair).eq('timeframe', cfg.timeframe)
      .order('ts', { ascending: false }).limit(300);

    if (!candleRows || candleRows.length < 250) {
      await supabase.from('events').insert({
        type: 'warning', stage: 'dry_run',
        message: `DRY-RUN: only ${candleRows?.length ?? 0} candles — need 250+, run more ticks to backfill`,
        payload: { probe, account, quote, upserted },
      });
      return new Response(JSON.stringify({ ok: true, probe, account, quote, upserted, closed,
        warning: 'insufficient_history' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candles: Candle[] = candleRows.reverse().map((r) => ({ ...r, ts: r.ts as string }));
    const features = computeFeatures(candles, cfg);
    const last = features[features.length - 1];
    const prev = features[features.length - 2];
    const strategy = getStrategy(cfg.strategy_key);
    if (!strategy) throw new Error('Strategy not registered');
    const signal = strategy.generateSignal(last, prev, cfg);

    if (!signal) {
      await supabase.from('events').insert({
        type: 'info', stage: 'dry_run',
        message: `DRY-RUN: no signal · bal ${account.balance} ${account.currency} · spread ${quote.spread_pips}p · candles+${upserted}`,
        payload: { probe, account, quote, last_features: last, upserted, closed },
      });
      return new Response(JSON.stringify({ ok: true, probe, account, quote, upserted, closed, signal: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Run risk engine with REAL spread + REAL balance.
    const today = new Date().toISOString().slice(0, 10);
    const { count: dailyCount } = await supabase.from('trades').select('*', { count: 'exact', head: true })
      .eq('mode', 'shadow').gte('entry_time', `${today}T00:00:00Z`);
    const { count: openCount } = await supabase.from('trades').select('*', { count: 'exact', head: true })
      .eq('mode', 'shadow').eq('status', 'open');

    const liveCfg: Config = {
      ...cfg,
      account_balance: typeof account.balance === 'number' ? account.balance : cfg.account_balance,
    };
    const state: RiskState = {
      daily_trade_count: dailyCount ?? 0,
      open_trade_count: openCount ?? 0,
      daily_loss_pct: 0,
      current_spread: quote.spread_pips!,
      current_drawdown_pct: 0,
    };

    const { data: sigRow } = await supabase.from('signals').insert({
      ts: signal.ts, pair: signal.pair, timeframe: signal.timeframe,
      strategy_key: signal.strategy_key, side: signal.side,
      confidence: signal.confidence,
      reason: { ...signal.reason, dry_run: true, live_quote: quote, live_balance: account.balance },
    }).select().single();

    const decision = evaluateRisk(signal, last, liveCfg, state);
    if (!decision.approved) {
      await supabase.from('signals').update({ approved: false, rejection_reason: decision.reason }).eq('id', sigRow!.id);
      await supabase.from('events').insert({
        type: 'risk', stage: 'shadow_risk', signal_id: sigRow!.id,
        message: `SHADOW signal rejected: ${decision.reason}`,
        payload: { signal, decision, account, quote },
      });
      return new Response(JSON.stringify({ ok: true, probe, account, quote, upserted, closed, signal, decision }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Write SHADOW TRADE — entry at the live ask/bid, no broker call.
    const entry_price = signal.side === 'LONG' ? quote.ask! : quote.bid!;
    const { data: tradeRow } = await supabase.from('trades').insert({
      mode: 'shadow', strategy_key: cfg.strategy_key, pair: cfg.pair, timeframe: cfg.timeframe,
      side: signal.side, entry_price,
      stop_loss: decision.sl_price, take_profit: decision.tp_price,
      lot_size: decision.position_size, risk_amount: decision.risk_amount,
      status: 'open', signal_id: sigRow!.id, entry_time: new Date().toISOString(),
    }).select().single();

    await supabase.from('signals').update({ approved: true, trade_id: tradeRow!.id }).eq('id', sigRow!.id);
    await supabase.from('events').insert({
      type: 'trade', stage: 'shadow_open', trade_id: tradeRow!.id, signal_id: sigRow!.id,
      message: `SHADOW ${signal.side} ${cfg.pair} @ ${entry_price} | SL ${decision.sl_price} TP ${decision.tp_price} (no order placed)`,
      payload: { account, quote, decision, mid },
    });

    return new Response(JSON.stringify({
      ok: true, probe, account, quote, upserted, closed,
      signal, decision, shadow_trade: tradeRow,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
