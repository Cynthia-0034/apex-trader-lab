// Feature Engineering Layer
// Computes EMA, RSI, ATR from candles.

import type { Candle, Features } from './types.ts';

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period + 1) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = 100 - 100 / (1 + (avgL === 0 ? 100 : avgG / avgL));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (avgL === 0 ? 100 : avgG / avgL));
  }
  return out;
}

export function atr(candles: Candle[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { trs.push(candles[i].high - candles[i].low); continue; }
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const out: number[] = new Array(candles.length).fill(NaN);
  if (trs.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trs[i];
  out[period - 1] = sum / period;
  for (let i = period; i < trs.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

export function computeFeatures(
  candles: Candle[],
  cfg: { ema_fast: number; ema_slow: number; rsi_period: number; atr_period: number; atr_min: number; atr_max: number },
): Features[] {
  const closes = candles.map((c) => c.close);
  const fast = ema(closes, cfg.ema_fast);
  const slow = ema(closes, cfg.ema_slow);
  const r = rsi(closes, cfg.rsi_period);
  const a = atr(candles, cfg.atr_period);
  return candles.map((c, i) => {
    const ef = fast[i], es = slow[i], rv = r[i], av = a[i];
    const trend: Features['trend'] = !isFinite(ef) || !isFinite(es) ? 'neutral' : ef > es ? 'bullish' : ef < es ? 'bearish' : 'neutral';
    const vol: Features['volatility_state'] = !isFinite(av) ? 'normal' : av < cfg.atr_min ? 'low' : av > cfg.atr_max ? 'high' : 'normal';
    return {
      ts: c.ts, close: c.close,
      ema_fast: +ef.toFixed(6), ema_slow: +es.toFixed(6),
      rsi: +(rv ?? 0).toFixed(2), atr: +(av ?? 0).toFixed(6),
      trend, volatility_state: vol,
    };
  });
}
