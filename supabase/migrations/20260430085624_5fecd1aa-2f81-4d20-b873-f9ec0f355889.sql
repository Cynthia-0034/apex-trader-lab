-- Risk audit trail: one row per risk evaluation, storing pass/fail per rule.
CREATE TABLE public.risk_audits (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mode trade_mode,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  side trade_side,
  approved BOOLEAN NOT NULL,
  rejection_reason TEXT,
  backtest_id UUID REFERENCES public.backtests(id) ON DELETE CASCADE,
  signal_id UUID,
  trade_id UUID,
  -- Per-rule audit: array of { rule, status: 'pass'|'fail'|'skipped', detail, threshold, actual }
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of inputs for traceability
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_risk_audits_backtest ON public.risk_audits(backtest_id) WHERE backtest_id IS NOT NULL;
CREATE INDEX idx_risk_audits_ts ON public.risk_audits(ts DESC);
CREATE INDEX idx_risk_audits_approved ON public.risk_audits(approved);

ALTER TABLE public.risk_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_risk_audits" ON public.risk_audits FOR SELECT USING (true);
CREATE POLICY "public_write_risk_audits" ON public.risk_audits FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_risk_audits" ON public.risk_audits FOR UPDATE USING (true);
CREATE POLICY "public_delete_risk_audits" ON public.risk_audits FOR DELETE USING (true);

-- Link trades + backtests so the page can load each run's trade history
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS backtest_id UUID REFERENCES public.backtests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_trades_backtest ON public.trades(backtest_id) WHERE backtest_id IS NOT NULL;
