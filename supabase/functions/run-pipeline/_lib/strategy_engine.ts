// Strategy Engine — pluggable design.
// Strategies implement the Strategy interface and are registered by key.

import type { Config, Features, Signal } from './types';

export interface Strategy {
  key: string;
  name: string;
  version: string;
  generateSignal(features: Features, prev: Features | undefined, cfg: Config): Signal | null;
}

const registry = new Map<string, Strategy>();
export function registerStrategy(s: Strategy) { registry.set(s.key, s); }
export function getStrategy(key: string): Strategy | undefined { return registry.get(key); }
export function listStrategies(): Strategy[] { return [...registry.values()]; }

// EMA + RSI v1
export const EmaRsiV1: Strategy = {
  key: 'ema_rsi_v1',
  name: 'EMA Crossover + RSI',
  version: 'v1',
  generateSignal(f, prev, cfg) {
    if (!prev) return null;
    if (!isFinite(f.ema_fast) || !isFinite(f.ema_slow) || !isFinite(f.rsi)) return null;

    const bullishCross = prev.ema_fast <= prev.ema_slow && f.ema_fast > f.ema_slow;
    const bearishCross = prev.ema_fast >= prev.ema_slow && f.ema_fast < f.ema_slow;
    const trendBull = f.trend === 'bullish' && f.rsi >= cfg.rsi_min;
    const trendBear = f.trend === 'bearish' && f.rsi <= 100 - cfg.rsi_min;

    if (bullishCross || (trendBull && prev.rsi < cfg.rsi_min && f.rsi >= cfg.rsi_min)) {
      const conf = Math.min(1, (f.rsi - 50) / 30);
      return {
        pair: cfg.pair, timeframe: cfg.timeframe, side: 'LONG',
        confidence: +conf.toFixed(2), strategy_key: this.key, ts: f.ts,
        reason: { trend: 'bullish', rsi: f.rsi, ema_fast: f.ema_fast, ema_slow: f.ema_slow, trigger: bullishCross ? 'cross' : 'pullback' },
      };
    }
    if (bearishCross || (trendBear && prev.rsi > 100 - cfg.rsi_min && f.rsi <= 100 - cfg.rsi_min)) {
      const conf = Math.min(1, (50 - f.rsi) / 30);
      return {
        pair: cfg.pair, timeframe: cfg.timeframe, side: 'SHORT',
        confidence: +conf.toFixed(2), strategy_key: this.key, ts: f.ts,
        reason: { trend: 'bearish', rsi: f.rsi, ema_fast: f.ema_fast, ema_slow: f.ema_slow, trigger: bearishCross ? 'cross' : 'pullback' },
      };
    }
    return null;
  },
};

registerStrategy(EmaRsiV1);
