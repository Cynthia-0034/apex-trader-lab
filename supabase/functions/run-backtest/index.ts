// Apex Engine — Backtest orchestration edge function.
// Loads candles, runs the modular pipeline, persists run + trades.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';
import { runBacktest } from '../_shared/backtest_engine.ts';
import type { Candle, Config } from '../_shared/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const name = body.name ?? `Backtest ${new Date().toISOString().slice(0, 16)}`;

    // Load active config
    const { data: cfgRow, error: cfgErr } = await supabase
      .from('configs').select('*').eq('active', true).single();
    if (cfgErr || !cfgRow) throw new Error('No active config');
    const cfg = cfgRow as unknown as Config;

    // Load candles
    const { data: candleRows, error: cErr } = await supabase
      .from('candles').select('ts,open,high,low,close,volume,spread')
      .eq('pair', cfg.pair).eq('timeframe', cfg.timeframe)
      .order('ts', { ascending: true }).limit(2000);
    if (cErr) throw cErr;
    if (!candleRows || candleRows.length < 250) {
      return new Response(JSON.stringify({ error: 'Not enough candles. Seed market data first.' }), {
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

    await supabase.from('events').insert({
      type: 'pipeline', stage: 'backtest',
      message: `Backtest "${name}" completed: ${result.metrics.total_trades} trades, ${result.metrics.win_rate}% win rate, PF ${result.metrics.profit_factor}`,
      payload: { backtest_id: bt.id, rejections: result.rejections.length },
    });

    return new Response(JSON.stringify({ backtest: bt, metrics: result.metrics, rejections: result.rejections }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
