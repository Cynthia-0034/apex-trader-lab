// Backtest Engine — candle-by-candle realistic simulation.
// Respects spread, risk rules, and never peeks into the future.

import type { Candle, Config, Side } from './types.ts';
import { computeFeatures } from './feature_engine.ts';
import { getStrategy } from './strategy_engine.ts';
import { evaluateRisk, type RiskState } from './risk_engine.ts';
import { PaperBroker, calcPnl } from './execution_engine.ts';
import { computeMetrics, type TradeStat } from './analytics.ts';

export interface BacktestTrade extends TradeStat {
  side: Side;
  entry_price: number;
  exit_price: number;
  sl: number;
  tp: number;
  lot: number;
  close_reason: 'TP' | 'SL' | 'EOD';
}

export interface BacktestRun {
  trades: BacktestTrade[];
  metrics: ReturnType<typeof computeMetrics>;
  rejections: { ts: string; reason: string }[];
}

export async function runBacktest(candles: Candle[], cfg: Config): Promise<BacktestRun> {
  const strategy = getStrategy(cfg.strategy_key);
  if (!strategy) throw new Error(`Unknown strategy: ${cfg.strategy_key}`);
  const broker = new PaperBroker();
  const features = computeFeatures(candles, cfg);

  const trades: BacktestTrade[] = [];
  const rejections: { ts: string; reason: string }[] = [];
  let openTrade: BacktestTrade | null = null;
  const state: RiskState = {
    daily_trade_count: 0, open_trade_count: 0,
    daily_loss_pct: 0, current_spread: broker.spread, current_drawdown_pct: 0,
  };
  let lastDay = '';
  let equity = cfg.account_balance;
  let peakEquity = equity;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const f = features[i];
    const prev = features[i - 1];
    const day = c.ts.slice(0, 10);
    if (day !== lastDay) { state.daily_trade_count = 0; state.daily_loss_pct = 0; lastDay = day; }

    // Manage open trade FIRST (no future peeking — use this candle's high/low only).
    if (openTrade) {
      let exit: number | null = null;
      let reason: BacktestTrade['close_reason'] | null = null;
      if (openTrade.side === 'LONG') {
        if (c.low <= openTrade.sl) { exit = openTrade.sl; reason = 'SL'; }
        else if (c.high >= openTrade.tp) { exit = openTrade.tp; reason = 'TP'; }
      } else {
        if (c.high >= openTrade.sl) { exit = openTrade.sl; reason = 'SL'; }
        else if (c.low <= openTrade.tp) { exit = openTrade.tp; reason = 'TP'; }
      }
      if (exit !== null && reason) {
        const { pnl } = calcPnl(openTrade.side, openTrade.entry_price, exit, openTrade.lot);
        openTrade.exit_price = exit;
        openTrade.exit_time = c.ts;
        openTrade.pnl = pnl;
        openTrade.close_reason = reason;
        const slDist = Math.abs(openTrade.entry_price - openTrade.sl);
        openTrade.r_multiple = +((reason === 'TP' ? cfg.rr_ratio : -1)).toFixed(2);
        equity += pnl;
        peakEquity = Math.max(peakEquity, equity);
        state.current_drawdown_pct = ((peakEquity - equity) / peakEquity) * 100;
        if (pnl < 0) state.daily_loss_pct += Math.abs(pnl) / cfg.account_balance * 100;
        state.open_trade_count = 0;
        state.last_trade_ts = c.ts;
        trades.push(openTrade);
        openTrade = null;
      }
    }

    if (openTrade) continue;

    // Generate signal
    const signal = strategy.generateSignal(f, prev, cfg);
    if (!signal) continue;

    // Risk gate
    const decision = evaluateRisk(signal, f, cfg, state);
    if (!decision.approved) {
      rejections.push({ ts: c.ts, reason: decision.reason ?? 'UNKNOWN' });
      continue;
    }

    // Execute (use close as fill price + spread)
    const fill = await broker.placeOrder({
      pair: cfg.pair, side: signal.side, entry_price: c.close,
      sl_price: decision.sl_price!, tp_price: decision.tp_price!,
      lot_size: decision.position_size!, risk_amount: decision.risk_amount!,
      strategy_key: cfg.strategy_key, timeframe: cfg.timeframe,
    }, c.close, c.ts);

    openTrade = {
      side: signal.side,
      entry_price: fill.filled_price,
      exit_price: 0,
      sl: decision.sl_price!,
      tp: decision.tp_price!,
      lot: decision.position_size!,
      pnl: 0,
      r_multiple: null,
      entry_time: c.ts,
      exit_time: null,
      close_reason: 'EOD',
    };
    state.daily_trade_count++;
    state.open_trade_count = 1;
  }

  const metrics = computeMetrics(trades, cfg.account_balance);
  return { trades, metrics, rejections };
}
