// Analytics Engine — performance metrics for backtest & live.

export interface TradeStat {
  pnl: number;
  r_multiple?: number | null;
  entry_time: string;
  exit_time?: string | null;
}

export interface PerformanceMetrics {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_profit: number;
  profit_factor: number;
  max_drawdown: number;
  sharpe_ratio: number;
  avg_r_multiple: number;
  equity_curve: { ts: string; equity: number }[];
}

export function computeMetrics(trades: TradeStat[], startingEquity = 10000): PerformanceMetrics {
  const closed = trades.filter((t) => t.exit_time);
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const net = closed.reduce((s, t) => s + t.pnl, 0);

  // Equity curve
  let eq = startingEquity;
  const curve: { ts: string; equity: number }[] = [{ ts: closed[0]?.entry_time ?? new Date().toISOString(), equity: eq }];
  let peak = eq, maxDD = 0;
  const returns: number[] = [];
  for (const t of closed) {
    const prev = eq;
    eq += t.pnl;
    returns.push((eq - prev) / prev);
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, ((peak - eq) / peak) * 100);
    curve.push({ ts: t.exit_time!, equity: +eq.toFixed(2) });
  }
  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length || 1);
  const std = Math.sqrt(variance);
  const sharpe = std === 0 ? 0 : (mean / std) * Math.sqrt(252);
  const avgR = closed.length === 0 ? 0 : closed.reduce((s, t) => s + (t.r_multiple ?? 0), 0) / closed.length;

  return {
    total_trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: closed.length === 0 ? 0 : +((wins.length / closed.length) * 100).toFixed(2),
    net_profit: +net.toFixed(2),
    profit_factor: grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : +(grossProfit / grossLoss).toFixed(2),
    max_drawdown: +maxDD.toFixed(2),
    sharpe_ratio: +sharpe.toFixed(2),
    avg_r_multiple: +avgR.toFixed(2),
    equity_curve: curve,
  };
}
