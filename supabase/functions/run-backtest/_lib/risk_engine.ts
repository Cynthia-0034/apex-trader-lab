// Risk Engine — MANDATORY GATE. No trade passes without this.
// evaluateRiskWithAudit returns the same decision plus a per-rule trail
// explaining exactly why a signal was accepted or rejected.

import type { Config, Features, RiskDecision, Signal } from './types.ts';

export interface RiskState {
  daily_trade_count: number;
  open_trade_count: number;
  daily_loss_pct: number;
  current_spread: number;
  last_trade_ts?: string;
  current_drawdown_pct: number;
}

export type RuleStatus = 'pass' | 'fail' | 'skipped';

export interface RuleAudit {
  rule: string;
  status: RuleStatus;
  detail: string;
  threshold?: number | string | boolean;
  actual?: number | string | boolean;
}

export interface RiskAudit {
  approved: boolean;
  rejection_reason?: string;
  rules: RuleAudit[];
  context: {
    ts: string;
    spread: number;
    atr: number;
    daily_trade_count: number;
    open_trade_count: number;
    daily_loss_pct: number;
    current_drawdown_pct: number;
    last_trade_ts?: string;
    close: number;
    side: Signal['side'];
  };
  decision: RiskDecision;
}

export function evaluateRiskWithAudit(
  signal: Signal,
  features: Features,
  cfg: Config,
  state: RiskState,
): RiskAudit {
  const rules: RuleAudit[] = [];
  let approved = true;
  let rejection_reason: string | undefined;

  const fail = (rule: string, reason: string, audit: Omit<RuleAudit, 'rule' | 'status'>) => {
    rules.push({ rule, status: approved ? 'fail' : 'skipped', ...audit });
    if (approved) { approved = false; rejection_reason = reason; }
  };
  const pass = (rule: string, audit: Omit<RuleAudit, 'rule' | 'status'>) => {
    rules.push({ rule, status: approved ? 'pass' : 'skipped', ...audit });
  };

  // 1. Kill switch
  if (cfg.kill_switch) {
    fail('kill_switch', 'KILL_SWITCH_ACTIVE',
      { detail: 'Master kill switch is engaged — all new trades blocked.', threshold: false, actual: true });
  } else {
    pass('kill_switch', { detail: 'Kill switch disarmed.', threshold: false, actual: false });
  }

  // 2. Circuit breaker
  if (state.current_drawdown_pct >= cfg.drawdown_circuit_breaker) {
    fail('drawdown_circuit_breaker', 'CIRCUIT_BREAKER_DRAWDOWN',
      { detail: `Drawdown ${state.current_drawdown_pct.toFixed(2)}% reached circuit breaker.`,
        threshold: cfg.drawdown_circuit_breaker, actual: +state.current_drawdown_pct.toFixed(2) });
  } else {
    pass('drawdown_circuit_breaker',
      { detail: 'Drawdown within limit.', threshold: cfg.drawdown_circuit_breaker, actual: +state.current_drawdown_pct.toFixed(2) });
  }

  // 3. Daily limits
  if (state.daily_trade_count >= cfg.max_daily_trades) {
    fail('max_daily_trades', 'MAX_DAILY_TRADES_REACHED',
      { detail: 'Daily trade cap reached.', threshold: cfg.max_daily_trades, actual: state.daily_trade_count });
  } else {
    pass('max_daily_trades', { detail: 'Below daily trade cap.', threshold: cfg.max_daily_trades, actual: state.daily_trade_count });
  }

  if (state.open_trade_count >= cfg.max_open_trades) {
    fail('max_open_trades', 'MAX_OPEN_TRADES_REACHED',
      { detail: 'Max concurrent open trades reached.', threshold: cfg.max_open_trades, actual: state.open_trade_count });
  } else {
    pass('max_open_trades', { detail: 'Open-trade slot available.', threshold: cfg.max_open_trades, actual: state.open_trade_count });
  }

  if (state.daily_loss_pct >= cfg.max_daily_loss) {
    fail('max_daily_loss', 'MAX_DAILY_LOSS_REACHED',
      { detail: `Daily loss ${state.daily_loss_pct.toFixed(2)}% breached limit.`,
        threshold: cfg.max_daily_loss, actual: +state.daily_loss_pct.toFixed(2) });
  } else {
    pass('max_daily_loss', { detail: 'Daily loss within limit.', threshold: cfg.max_daily_loss, actual: +state.daily_loss_pct.toFixed(2) });
  }

  // 4. Spread
  if (state.current_spread > cfg.spread_threshold) {
    fail('spread', 'SPREAD_TOO_HIGH',
      { detail: `Spread ${state.current_spread} exceeds threshold.`, threshold: cfg.spread_threshold, actual: state.current_spread });
  } else {
    pass('spread', { detail: 'Spread acceptable.', threshold: cfg.spread_threshold, actual: state.current_spread });
  }

  // 5. ATR
  if (features.atr < cfg.atr_min) {
    fail('atr_min', 'ATR_TOO_LOW',
      { detail: 'Volatility (ATR) below minimum.', threshold: cfg.atr_min, actual: features.atr });
  } else if (features.atr > cfg.atr_max) {
    fail('atr_max', 'ATR_TOO_HIGH',
      { detail: 'Volatility (ATR) above maximum.', threshold: cfg.atr_max, actual: features.atr });
  } else {
    pass('atr_band', { detail: 'ATR within accepted band.',
      threshold: `${cfg.atr_min}–${cfg.atr_max}`, actual: features.atr });
  }

  // 6. Cooldown
  if (state.last_trade_ts) {
    const elapsedMin = (new Date(features.ts).getTime() - new Date(state.last_trade_ts).getTime()) / 60000;
    if (elapsedMin < cfg.cooldown_minutes) {
      fail('cooldown', 'COOLDOWN_ACTIVE',
        { detail: `Cooldown active (${elapsedMin.toFixed(1)} of ${cfg.cooldown_minutes} min).`,
          threshold: cfg.cooldown_minutes, actual: +elapsedMin.toFixed(1) });
    } else {
      pass('cooldown', { detail: 'Cooldown elapsed.', threshold: cfg.cooldown_minutes, actual: +elapsedMin.toFixed(1) });
    }
  } else {
    pass('cooldown', { detail: 'No prior trade — cooldown N/A.', threshold: cfg.cooldown_minutes, actual: 0 });
  }

  // 7. Position sizing
  const sl_distance = features.atr * cfg.atr_sl_multiplier;
  const tp_distance = sl_distance * cfg.rr_ratio;
  const risk_amount = cfg.account_balance * (cfg.risk_per_trade / 100);
  const position_size = +(risk_amount / (sl_distance * 100000)).toFixed(2);

  let decision: RiskDecision;
  if (position_size <= 0) {
    fail('position_size', 'POSITION_SIZE_ZERO',
      { detail: 'Computed position size rounded to zero.', threshold: '>0', actual: position_size });
    decision = { approved: false, reason: rejection_reason };
  } else {
    pass('position_size', { detail: `Sized to ${position_size} lot.`, threshold: '>0', actual: position_size });
    const sl_price = signal.side === 'LONG' ? features.close - sl_distance : features.close + sl_distance;
    const tp_price = signal.side === 'LONG' ? features.close + tp_distance : features.close - tp_distance;
    decision = approved
      ? {
          approved: true,
          position_size,
          sl_price: +sl_price.toFixed(5),
          tp_price: +tp_price.toFixed(5),
          risk_amount: +risk_amount.toFixed(2),
        }
      : { approved: false, reason: rejection_reason };
  }

  return {
    approved,
    rejection_reason,
    rules,
    context: {
      ts: features.ts,
      spread: state.current_spread,
      atr: features.atr,
      daily_trade_count: state.daily_trade_count,
      open_trade_count: state.open_trade_count,
      daily_loss_pct: +state.daily_loss_pct.toFixed(4),
      current_drawdown_pct: +state.current_drawdown_pct.toFixed(4),
      last_trade_ts: state.last_trade_ts,
      close: features.close,
      side: signal.side,
    },
    decision,
  };
}

// Backwards-compatible thin wrapper.
export function evaluateRisk(
  signal: Signal,
  features: Features,
  cfg: Config,
  state: RiskState,
): RiskDecision {
  return evaluateRiskWithAudit(signal, features, cfg, state).decision;
}
