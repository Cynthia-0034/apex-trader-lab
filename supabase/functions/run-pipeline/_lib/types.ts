// Shared types for the Apex Engine trading pipeline.
// Used by both the UI and (mirrored in) edge functions.

export type Mode = 'backtest' | 'paper' | 'live';
export type Side = 'LONG' | 'SHORT';
export type TradeStatus = 'open' | 'closed' | 'cancelled' | 'rejected';

export interface Candle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread?: number;
}

export interface Features {
  ts: string;
  ema_fast: number;
  ema_slow: number;
  rsi: number;
  atr: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  volatility_state: 'low' | 'normal' | 'high';
  close: number;
}

export interface Signal {
  pair: string;
  timeframe: string;
  side: Side;
  confidence: number;
  reason: Record<string, unknown>;
  strategy_key: string;
  ts: string;
}

export interface RiskDecision {
  approved: boolean;
  reason?: string;
  position_size?: number;
  sl_price?: number;
  tp_price?: number;
  risk_amount?: number;
}

export interface Order {
  pair: string;
  side: Side;
  entry_price: number;
  sl_price: number;
  tp_price: number;
  lot_size: number;
  risk_amount: number;
  signal_id?: string;
  strategy_key: string;
  timeframe: string;
}

export interface BrokerFill {
  filled_price: number;
  ts: string;
  spread: number;
}

export interface Config {
  mode: Mode;
  pair: string;
  timeframe: string;
  account_balance: number;
  risk_per_trade: number;
  max_daily_trades: number;
  max_open_trades: number;
  max_daily_loss: number;
  spread_threshold: number;
  atr_min: number;
  atr_max: number;
  ema_fast: number;
  ema_slow: number;
  rsi_period: number;
  rsi_min: number;
  atr_period: number;
  atr_sl_multiplier: number;
  rr_ratio: number;
  cooldown_minutes: number;
  drawdown_circuit_breaker: number;
  kill_switch: boolean;
  strategy_key: string;
}

export type EngineEvent =
  | { type: 'CANDLE_INGESTED'; payload: { count: number } }
  | { type: 'FEATURES_COMPUTED'; payload: Features }
  | { type: 'SIGNAL_GENERATED'; payload: Signal }
  | { type: 'SIGNAL_REJECTED'; payload: { reason: string; signal: Signal } }
  | { type: 'TRADE_APPROVED'; payload: { order: Order; signal: Signal } }
  | { type: 'RISK_REJECTED'; payload: { reason: string; signal: Signal } }
  | { type: 'TRADE_EXECUTED'; payload: { order: Order; fill: BrokerFill } }
  | { type: 'TRADE_CLOSED'; payload: { trade_id: string; pnl: number; reason: string } };
