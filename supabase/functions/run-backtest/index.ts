// Apex Engine — Backtest orchestration edge function.
// Loads candles, runs the modular pipeline, persists run + trades.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';
import { runBacktest } from './_lib/backtest_engine.ts';
import type { Candle, Config } from './_lib/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const name = body.name ?? `Backtest ${new Date().toISOString().slice(0, 16)}`;
    const autoSeed = body.auto_seed !== false; // default true
    const seedCount = body.seed_count ?? 1500;

    // Load active config
    const { data: cfgRow, error: cfgErr } = await supabase
      .from('configs').select('*').eq('active', true).single();
    if (cfgErr || !cfgRow) throw new Error('No active config');
    const cfg = cfgRow as unknown as Config;

    // Load candles (auto-seed if missing)
    let seeded = 0;
    const loadCandles = async () => await supabase
      .from('candles').select('ts,open,high,low,close,volume,spread')
      .eq('pair', cfg.pair).eq('timeframe', cfg.timeframe)
      .order('ts', { ascending: true }).limit(2000);

    let { data: candleRows, error: cErr } = await loadCandles();
    if (cErr) throw cErr;

    if ((!candleRows || candleRows.length < 250) && autoSeed) {
      await supabase.from('events').insert({
        type: 'pipeline', stage: 'ingestion',
        message: `Auto-seeding ${seedCount} candles for backtest…`,
        payload: { reason: 'insufficient_history', requested: seedCount },
      });
      const { data: seedRes, error: seedErr } = await supabase.functions.invoke('seed-data', { body: { count: seedCount } });
      if (seedErr) throw new Error(`Auto-seed failed: ${seedErr.message}`);
      seeded = seedRes?.inserted ?? 0;
      ({ data: candleRows, error: cErr } = await loadCandles());
      if (cErr) throw cErr;
    }

    if (!candleRows || candleRows.length < 250) {
      return new Response(JSON.stringify({ error: 'Not enough candles. Enable auto-seed or seed market data first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const candles: Candle[] = candleRows.map((r) => ({ ...r, ts: r.ts as string }));

    // Pipeline: features → strategy → risk → execution → analytics
    const result = await runBacktest(candles, cfg);

    // Persist
    const { data: bt, error: btErr } = await supabase.from('backtests').insert({
      name, strategy_key: cfg.strategy_key, pair: cfg.pair, timeframe: cfg.timeframe,
      start_date: candles[0].ts, end_date: candles[candles.length - 1].ts,
      config: cfg as unknown as Record<string, unknown>,
      total_trades: result.metrics.total_trades,
      win_rate: result.metrics.win_rate,
      profit_factor: result.metrics.profit_factor,
      max_drawdown: result.metrics.max_drawdown,
      net_profit: result.metrics.net_profit,
      sharpe_ratio: result.metrics.sharpe_ratio,
      avg_r_multiple: result.metrics.avg_r_multiple,
      equity_curve: result.metrics.equity_curve,
    }).select().single();
    if (btErr) throw btErr;

    // Persist trades for this run
    if (result.trades.length) {
      const tradeRows = result.trades.map((t) => ({
        backtest_id: bt.id,
        mode: cfg.mode,
        strategy_key: cfg.strategy_key,
        pair: cfg.pair,
        timeframe: cfg.timeframe,
        side: t.side,
        entry_price: t.entry_price,
        exit_price: t.exit_price,
        stop_loss: t.sl,
        take_profit: t.tp,
        lot_size: t.lot,
        risk_amount: cfg.account_balance * (cfg.risk_per_trade / 100),
        pnl: t.pnl,
        r_multiple: t.r_multiple,
        entry_time: t.entry_time,
        exit_time: t.exit_time,
        status: 'closed',
        close_reason: t.close_reason,
      }));
      // Chunk inserts to stay under request limits
      for (let i = 0; i < tradeRows.length; i += 500) {
        const { error: trErr } = await supabase.from('trades').insert(tradeRows.slice(i, i + 500));
        if (trErr) console.error('trade insert error', trErr);
      }
    }

    // Persist risk audit trail (per-rule pass/fail per evaluated signal)
    if (result.audits.length) {
      const auditRows = result.audits.map((a) => ({
        mode: cfg.mode,
        pair: cfg.pair,
        timeframe: cfg.timeframe,
        strategy_key: cfg.strategy_key,
        side: a.context.side,
        approved: a.approved,
        rejection_reason: a.rejection_reason ?? null,
        backtest_id: bt.id,
        rules: a.rules,
        context: a.context,
        decision: a.decision,
      }));
      for (let i = 0; i < auditRows.length; i += 500) {
        const { error: auErr } = await supabase.from('risk_audits').insert(auditRows.slice(i, i + 500));
        if (auErr) console.error('audit insert error', auErr);
      }
    }

    await supabase.from('events').insert({
      type: 'pipeline', stage: 'backtest',
      message: `Backtest "${name}" completed: ${result.metrics.total_trades} trades, ${result.metrics.win_rate}% win rate, PF ${result.metrics.profit_factor}`,
      payload: { backtest_id: bt.id, rejections: result.rejections.length, audits: result.audits.length },
    });

    return new Response(JSON.stringify({ backtest: bt, metrics: result.metrics, rejections: result.rejections, seeded }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
