// Risk Engine — MANDATORY GATE. No trade passes without this.

import type { Config, Features, RiskDecision, Signal } from './types.ts';

export interface RiskState {
  daily_trade_count: number;
  open_trade_count: number;
  daily_loss_pct: number;
  current_spread: number;
  last_trade_ts?: string;
  current_drawdown_pct: number;
}

export function evaluateRisk(
  signal: Signal,
  features: Features,
  cfg: Config,
  state: RiskState,
): RiskDecision {
  // 1. Kill switch
  if (cfg.kill_switch) return { approved: false, reason: 'KILL_SWITCH_ACTIVE' };

  // 2. Circuit breaker
  if (state.current_drawdown_pct >= cfg.drawdown_circuit_breaker) {
    return { approved: false, reason: 'CIRCUIT_BREAKER_DRAWDOWN' };
  }

  // 3. Daily limits
  if (state.daily_trade_count >= cfg.max_daily_trades) return { approved: false, reason: 'MAX_DAILY_TRADES_REACHED' };
  if (state.open_trade_count >= cfg.max_open_trades) return { approved: false, reason: 'MAX_OPEN_TRADES_REACHED' };
  if (state.daily_loss_pct >= cfg.max_daily_loss) return { approved: false, reason: 'MAX_DAILY_LOSS_REACHED' };

  // 4. Spread filter
  if (state.current_spread > cfg.spread_threshold) return { approved: false, reason: 'SPREAD_TOO_HIGH' };

  // 5. ATR (volatility) filter
  if (features.atr < cfg.atr_min) return { approved: false, reason: 'ATR_TOO_LOW' };
  if (features.atr > cfg.atr_max) return { approved: false, reason: 'ATR_TOO_HIGH' };

  // 6. Cooldown
  if (state.last_trade_ts) {
    const elapsedMin = (new Date(features.ts).getTime() - new Date(state.last_trade_ts).getTime()) / 60000;
    if (elapsedMin < cfg.cooldown_minutes) return { approved: false, reason: 'COOLDOWN_ACTIVE' };
  }

  // 7. Position sizing
  const sl_distance = features.atr * cfg.atr_sl_multiplier;
  const tp_distance = sl_distance * cfg.rr_ratio;
  const risk_amount = cfg.account_balance * (cfg.risk_per_trade / 100);
  // For FX, 1 standard lot = 100,000 units. Pip value ≈ lot * 10 for EURUSD.
  // lot_size = risk_amount / (sl_distance * 100000)
  const position_size = +(risk_amount / (sl_distance * 100000)).toFixed(2);
  if (position_size <= 0) return { approved: false, reason: 'POSITION_SIZE_ZERO' };

  const sl_price = signal.side === 'LONG' ? features.close - sl_distance : features.close + sl_distance;
  const tp_price = signal.side === 'LONG' ? features.close + tp_distance : features.close - tp_distance;

  return {
    approved: true,
    position_size,
    sl_price: +sl_price.toFixed(5),
    tp_price: +tp_price.toFixed(5),
    risk_amount: +risk_amount.toFixed(2),
  };
}
