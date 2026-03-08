import { mockConfig } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Strategy() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Strategy — EMA Crossover v1
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trend-following strategy using EMA crossover with RSI confirmation and ATR-based risk management.
        </p>
      </motion.div>

      {/* Indicators */}
      <motion.div variants={item} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'EMA Fast', value: String(mockConfig.ema50Period), desc: 'Trend direction' },
          { label: 'EMA Slow', value: String(mockConfig.ema200Period), desc: 'Trend filter' },
          { label: 'RSI Period', value: String(mockConfig.rsiPeriod), desc: 'Momentum' },
          { label: 'ATR Period', value: String(mockConfig.atrPeriod), desc: 'Volatility' },
        ].map((ind) => (
          <div key={ind.label} className="trading-card text-center">
            <span className="metric-label">{ind.label}</span>
            <div className="metric-value mt-1">{ind.value}</div>
            <span className="text-xs text-muted-foreground">{ind.desc}</span>
          </div>
        ))}
      </motion.div>

      {/* Entry Rules */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div variants={item} className="trading-card">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-profit" />
            Long Entry Rules
          </h2>
          <ul className="space-y-2 text-sm">
            {[
              'EMA 50 > EMA 200 (bullish trend)',
              'Price pulls back toward EMA 50',
              'RSI > 55 (momentum confirmation)',
              `Spread < ${mockConfig.spreadThreshold} pips`,
              `ATR between ${mockConfig.atrMin} — ${mockConfig.atrMax}`,
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <ArrowRight className="h-3 w-3 mt-1 text-profit shrink-0" />
                <span className="text-muted-foreground">{rule}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={item} className="trading-card">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-loss" />
            Short Entry Rules
          </h2>
          <ul className="space-y-2 text-sm">
            {[
              'EMA 50 < EMA 200 (bearish trend)',
              'Price pulls back toward EMA 50',
              'RSI < 45 (momentum confirmation)',
              `Spread < ${mockConfig.spreadThreshold} pips`,
              `ATR between ${mockConfig.atrMin} — ${mockConfig.atrMax}`,
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <ArrowRight className="h-3 w-3 mt-1 text-loss shrink-0" />
                <span className="text-muted-foreground">{rule}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Exit Rules */}
      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-4">Exit Rules & Risk Management</h2>
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <span className="metric-label">Stop Loss</span>
            <p className="mt-1 text-muted-foreground">ATR × {mockConfig.atrSlMultiplier}</p>
          </div>
          <div>
            <span className="metric-label">Take Profit</span>
            <p className="mt-1 text-muted-foreground">2 × Stop Loss distance</p>
          </div>
          <div>
            <span className="metric-label">Risk:Reward</span>
            <p className="mt-1 text-muted-foreground">1:{mockConfig.rrRatio}</p>
          </div>
        </div>
      </motion.div>

      {/* Config */}
      <motion.div variants={item} className="trading-card">
        <h2 className="text-sm font-semibold mb-3">Current Parameters</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(mockConfig).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="font-mono text-xs">
              {k}: {String(v)}
            </Badge>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
