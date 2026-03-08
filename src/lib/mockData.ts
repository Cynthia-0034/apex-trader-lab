// Mock EURUSD candle data and trading results

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  mode: 'backtest' | 'paper' | 'live';
  direction: 'LONG' | 'SHORT';
  pair: string;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  pnl: number | null;
  pnlPips: number | null;
  status: 'open' | 'closed' | 'cancelled';
  entryTime: string;
  exitTime: string | null;
  strategy: string;
}

export interface BacktestResult {
  id: string;
  name: string;
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  netProfit: number;
  sharpeRatio: number;
  equityCurve: { date: string; equity: number }[];
  trades: Trade[];
}

export interface SystemEvent {
  id: string;
  type: 'info' | 'warning' | 'error' | 'trade' | 'signal';
  message: string;
  timestamp: string;
}

export interface RiskStatus {
  dailyTradeCount: number;
  maxDailyTrades: number;
  openTradeCount: number;
  maxOpenTrades: number;
  dailyLoss: number;
  maxDailyLoss: number;
  killSwitch: boolean;
  spreadOk: boolean;
  atrOk: boolean;
}

// Generate realistic EURUSD candles
function generateCandles(count: number, startPrice: number = 1.0850): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;
  const baseDate = new Date('2024-01-02T00:00:00Z');

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.498) * 0.003;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 0.001;
    const low = Math.min(open, close) - Math.random() * 0.001;
    price = close;

    candles.push({
      time: new Date(baseDate.getTime() + i * 3600000).toISOString(),
      open: +open.toFixed(5),
      high: +high.toFixed(5),
      low: +low.toFixed(5),
      close: +close.toFixed(5),
      volume: Math.floor(1000 + Math.random() * 5000),
    });
  }
  return candles;
}

// Generate equity curve
function generateEquityCurve(days: number): { date: string; equity: number }[] {
  const points: { date: string; equity: number }[] = [];
  let equity = 10000;
  const baseDate = new Date('2024-01-02');

  for (let i = 0; i < days; i++) {
    const dailyReturn = (Math.random() - 0.42) * 150;
    equity = Math.max(8000, equity + dailyReturn);
    points.push({
      date: new Date(baseDate.getTime() + i * 86400000).toISOString().split('T')[0],
      equity: +equity.toFixed(2),
    });
  }
  return points;
}

// Generate mock trades
function generateTrades(count: number): Trade[] {
  const trades: Trade[] = [];
  const baseDate = new Date('2024-01-02T08:00:00Z');

  for (let i = 0; i < count; i++) {
    const isLong = Math.random() > 0.5;
    const entryPrice = 1.085 + (Math.random() - 0.5) * 0.02;
    const slDistance = 0.001 + Math.random() * 0.001;
    const tpDistance = slDistance * 2;
    const won = Math.random() > 0.42;
    const exitPrice = isLong
      ? (won ? entryPrice + tpDistance : entryPrice - slDistance)
      : (won ? entryPrice - tpDistance : entryPrice + slDistance);
    const pnlPips = isLong
      ? (exitPrice - entryPrice) * 10000
      : (entryPrice - exitPrice) * 10000;

    trades.push({
      id: `T-${String(i + 1).padStart(4, '0')}`,
      mode: 'backtest',
      direction: isLong ? 'LONG' : 'SHORT',
      pair: 'EURUSD',
      entryPrice: +entryPrice.toFixed(5),
      exitPrice: +exitPrice.toFixed(5),
      stopLoss: +(isLong ? entryPrice - slDistance : entryPrice + slDistance).toFixed(5),
      takeProfit: +(isLong ? entryPrice + tpDistance : entryPrice - tpDistance).toFixed(5),
      lotSize: 0.1,
      pnl: +(pnlPips * 1).toFixed(2),
      pnlPips: +pnlPips.toFixed(1),
      status: 'closed',
      entryTime: new Date(baseDate.getTime() + i * 43200000).toISOString(),
      exitTime: new Date(baseDate.getTime() + i * 43200000 + 7200000).toISOString(),
      strategy: 'EMA Crossover v1',
    });
  }
  return trades;
}

export const mockCandles = generateCandles(500);

export const mockTrades = generateTrades(48);

export const mockBacktest: BacktestResult = {
  id: 'BT-001',
  name: 'EMA Crossover v1 — EURUSD H1',
  pair: 'EURUSD',
  timeframe: 'H1',
  startDate: '2024-01-02',
  endDate: '2024-06-30',
  totalTrades: 48,
  winRate: 58.3,
  profitFactor: 1.82,
  maxDrawdown: 4.2,
  netProfit: 1847.50,
  sharpeRatio: 1.34,
  equityCurve: generateEquityCurve(180),
  trades: mockTrades,
};

export const mockEvents: SystemEvent[] = [
  { id: 'E001', type: 'info', message: 'System initialized — Paper Trading mode active', timestamp: '2024-06-30T08:00:00Z' },
  { id: 'E002', type: 'signal', message: 'LONG signal detected on EURUSD H1 — EMA50 > EMA200, RSI 58.2', timestamp: '2024-06-30T09:00:00Z' },
  { id: 'E003', type: 'trade', message: 'Paper trade opened — LONG EURUSD @ 1.08450, SL: 1.08280, TP: 1.08790', timestamp: '2024-06-30T09:00:12Z' },
  { id: 'E004', type: 'info', message: 'Candle sync completed — 500 candles loaded', timestamp: '2024-06-30T09:01:00Z' },
  { id: 'E005', type: 'warning', message: 'Spread elevated: 2.8 pips (threshold: 2.5)', timestamp: '2024-06-30T10:00:00Z' },
  { id: 'E006', type: 'trade', message: 'Paper trade closed — TP hit, +34 pips, PnL: +$34.00', timestamp: '2024-06-30T11:30:00Z' },
  { id: 'E007', type: 'info', message: 'Daily trade limit: 1/2 used', timestamp: '2024-06-30T11:30:05Z' },
  { id: 'E008', type: 'error', message: 'MT5 connection timeout — retrying in 30s', timestamp: '2024-06-30T12:00:00Z' },
  { id: 'E009', type: 'info', message: 'MT5 reconnected successfully', timestamp: '2024-06-30T12:00:35Z' },
  { id: 'E010', type: 'signal', message: 'Signal rejected — RSI 52.1 below threshold (55)', timestamp: '2024-06-30T13:00:00Z' },
];

export const mockRiskStatus: RiskStatus = {
  dailyTradeCount: 1,
  maxDailyTrades: 2,
  openTradeCount: 0,
  maxOpenTrades: 1,
  dailyLoss: 0.8,
  maxDailyLoss: 3.0,
  killSwitch: false,
  spreadOk: true,
  atrOk: true,
};

export const mockConfig = {
  platform: 'MetaTrader 5',
  pair: 'EURUSD',
  timeframe: 'H1',
  riskPerTrade: 1.0,
  maxDailyTrades: 2,
  maxOpenTrades: 1,
  maxDailyLoss: 3.0,
  spreadThreshold: 2.5,
  atrMin: 0.0005,
  atrMax: 0.005,
  ema50Period: 50,
  ema200Period: 200,
  rsiPeriod: 14,
  atrPeriod: 14,
  atrSlMultiplier: 1.5,
  rrRatio: 2.0,
  mode: 'paper' as 'backtest' | 'paper' | 'live',
};
