
-- Enums
CREATE TYPE public.trade_mode AS ENUM ('backtest','paper','live');
CREATE TYPE public.trade_side AS ENUM ('LONG','SHORT');
CREATE TYPE public.trade_status AS ENUM ('open','closed','cancelled','rejected');
CREATE TYPE public.event_type AS ENUM ('info','warning','error','trade','signal','risk','pipeline');

-- Strategies registry
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configs (single active config + history)
CREATE TABLE public.configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'default',
  active BOOLEAN NOT NULL DEFAULT false,
  mode public.trade_mode NOT NULL DEFAULT 'paper',
  pair TEXT NOT NULL DEFAULT 'EURUSD',
  timeframe TEXT NOT NULL DEFAULT 'H1',
  account_balance NUMERIC NOT NULL DEFAULT 10000,
  risk_per_trade NUMERIC NOT NULL DEFAULT 1.0,
  max_daily_trades INT NOT NULL DEFAULT 2,
  max_open_trades INT NOT NULL DEFAULT 1,
  max_daily_loss NUMERIC NOT NULL DEFAULT 3.0,
  spread_threshold NUMERIC NOT NULL DEFAULT 2.5,
  atr_min NUMERIC NOT NULL DEFAULT 0.0005,
  atr_max NUMERIC NOT NULL DEFAULT 0.005,
  ema_fast INT NOT NULL DEFAULT 50,
  ema_slow INT NOT NULL DEFAULT 200,
  rsi_period INT NOT NULL DEFAULT 14,
  rsi_min NUMERIC NOT NULL DEFAULT 55,
  atr_period INT NOT NULL DEFAULT 14,
  atr_sl_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  rr_ratio NUMERIC NOT NULL DEFAULT 2.0,
  cooldown_minutes INT NOT NULL DEFAULT 60,
  drawdown_circuit_breaker NUMERIC NOT NULL DEFAULT 10.0,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  strategy_key TEXT NOT NULL DEFAULT 'ema_rsi_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_config ON public.configs(active) WHERE active = true;

-- Candles (deduped by pair/tf/time)
CREATE TABLE public.candles (
  id BIGSERIAL PRIMARY KEY,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL DEFAULT 0,
  spread NUMERIC,
  source TEXT NOT NULL DEFAULT 'mock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pair, timeframe, ts)
);
CREATE INDEX candles_pair_tf_ts ON public.candles(pair, timeframe, ts DESC);

-- Features (per candle)
CREATE TABLE public.features (
  id BIGSERIAL PRIMARY KEY,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  ema_fast NUMERIC,
  ema_slow NUMERIC,
  rsi NUMERIC,
  atr NUMERIC,
  trend TEXT,
  volatility_state TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pair, timeframe, ts)
);

-- Signals
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  side public.trade_side NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  reason JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved BOOLEAN,
  rejection_reason TEXT,
  trade_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trades
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode public.trade_mode NOT NULL,
  strategy_key TEXT NOT NULL,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  side public.trade_side NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  stop_loss NUMERIC NOT NULL,
  take_profit NUMERIC NOT NULL,
  lot_size NUMERIC NOT NULL,
  risk_amount NUMERIC NOT NULL,
  pnl NUMERIC,
  pnl_pips NUMERIC,
  r_multiple NUMERIC,
  status public.trade_status NOT NULL DEFAULT 'open',
  signal_id UUID REFERENCES public.signals(id),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time TIMESTAMPTZ,
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trades_status ON public.trades(status);
CREATE INDEX trades_entry_time ON public.trades(entry_time DESC);

-- Events / audit log
CREATE TABLE public.events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.event_type NOT NULL,
  stage TEXT,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  trade_id UUID,
  signal_id UUID
);
CREATE INDEX events_ts ON public.events(ts DESC);

-- Equity snapshots
CREATE TABLE public.equity_snapshots (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode public.trade_mode NOT NULL,
  equity NUMERIC NOT NULL,
  balance NUMERIC NOT NULL,
  open_pnl NUMERIC NOT NULL DEFAULT 0,
  drawdown NUMERIC NOT NULL DEFAULT 0
);

-- Backtest runs
CREATE TABLE public.backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_trades INT NOT NULL DEFAULT 0,
  win_rate NUMERIC,
  profit_factor NUMERIC,
  max_drawdown NUMERIC,
  net_profit NUMERIC,
  sharpe_ratio NUMERIC,
  avg_r_multiple NUMERIC,
  equity_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger for configs
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER configs_updated_at BEFORE UPDATE ON public.configs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS on all tables
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;

-- Single-user research platform: open policies (no auth scope yet).
-- All tables: allow anon + authenticated full access.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['strategies','configs','candles','features','signals','trades','events','equity_snapshots','backtests'])
  LOOP
    EXECUTE format('CREATE POLICY "public_read_%I" ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "public_write_%I" ON public.%I FOR INSERT WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "public_update_%I" ON public.%I FOR UPDATE USING (true)', t, t);
    EXECUTE format('CREATE POLICY "public_delete_%I" ON public.%I FOR DELETE USING (true)', t, t);
  END LOOP;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;

-- Seed strategy + default config
INSERT INTO public.strategies (key, name, version, description)
VALUES ('ema_rsi_v1','EMA Crossover + RSI','v1','EMA50/200 trend, RSI14 momentum, ATR14 SL/TP');

INSERT INTO public.configs (name, active) VALUES ('default', true);
