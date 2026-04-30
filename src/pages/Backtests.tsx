import { MetricCard } from "@/components/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, DollarSign, AlertTriangle, Target, Activity, Inbox,
  Play, Loader2, Database, ShieldCheck, ShieldAlert, ChevronRight,
} from "lucide-react";
import { CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, XAxis, YAxis } from "recharts";
import {
  useRunBacktest, useCandleCount, useBacktests, useBacktest,
  useBacktestTrades, useBacktestAudits,
} from "@/hooks/useEngine";
import { useEffect, useMemo, useState } from "react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

type RuleAudit = { rule: string; status: 'pass' | 'fail' | 'skipped'; detail: string; threshold?: unknown; actual?: unknown };

export default function Backtests() {
  const { data: runs = [], isLoading: runsLoading } = useBacktests();
  const { data: candleCount = 0 } = useCandleCount();
  const [autoSeed, setAutoSeed] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const run = useRunBacktest();

  // Auto-select most recent run
  useEffect(() => {
    if (!selectedId && runs.length) setSelectedId(runs[0].id);
  }, [runs, selectedId]);

  const { data: bt } = useBacktest(selectedId);
  const { data: trades = [] } = useBacktestTrades(selectedId);
  const { data: audits = [] } = useBacktestAudits(selectedId);

  const needsSeed = candleCount < 250;
  const phase = run.isPending ? (needsSeed && autoSeed ? 'Seeding candle history…' : 'Running backtest…') : null;

  const ruleStats = useMemo(() => {
    const acc: Record<string, { pass: number; fail: number }> = {};
    for (const a of audits) {
      const rules = (a.rules as RuleAudit[]) ?? [];
      for (const r of rules) {
        if (r.status === 'skipped') continue;
        acc[r.rule] = acc[r.rule] ?? { pass: 0, fail: 0 };
        acc[r.rule][r.status]++;
      }
    }
    return Object.entries(acc).sort((a, b) => (b[1].fail + b[1].pass) - (a[1].fail + a[1].pass));
  }, [audits]);

  const approvedCount = audits.filter((a) => a.approved).length;
  const rejectedCount = audits.length - approvedCount;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Backtests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {runs.length} run{runs.length === 1 ? '' : 's'} on record
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <Database className="h-3 w-3" /> {candleCount} candles
          </Badge>
          <div className="flex items-center gap-2">
            <Switch id="auto-seed" checked={autoSeed} onCheckedChange={setAutoSeed} disabled={run.isPending} />
            <Label htmlFor="auto-seed" className="text-xs cursor-pointer">Auto-seed</Label>
          </div>
          <Button size="sm" onClick={() => run.mutate({ auto_seed: autoSeed })} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {run.isPending ? 'Working…' : 'Run new backtest'}
          </Button>
        </div>
      </motion.div>

      {phase && (
        <motion.div variants={item}>
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>{phase}</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              {needsSeed && autoSeed
                ? 'Generating ~1500 candles of mock market history before running the simulation.'
                : 'Running pipeline: features → strategy → risk → execution → analytics.'}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {run.isError && !run.isPending && (
        <motion.div variants={item}>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Backtest failed</AlertTitle>
            <AlertDescription>{(run.error as Error)?.message ?? 'Unknown error'}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Run list */}
        <motion.div variants={item} className="trading-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <h2 className="text-sm font-semibold">All runs</h2>
          </div>
          {runsLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-xs">No backtests yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[520px]">
              <ul className="divide-y divide-border/60">
                {runs.map((r) => {
                  const active = r.id === selectedId;
                  const pf = Number(r.profit_factor ?? 0);
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-2 ${active ? 'bg-accent/60' : 'hover:bg-accent/30'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {r.pair} · {r.timeframe} · {r.strategy_key}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                            <span className="text-muted-foreground">{r.total_trades} trades</span>
                            <span className={pf >= 1 ? 'text-profit' : 'text-loss'}>PF {pf.toFixed(2)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 mt-1 transition-opacity ${active ? 'opacity-100 text-primary' : 'opacity-30'}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </motion.div>

        {/* Detail */}
        <motion.div variants={item} className="space-y-4 min-w-0">
          {!bt ? (
            <div className="trading-card flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Inbox className="h-10 w-10" />
              <p className="text-sm">Select a backtest from the list to load its metrics, trade history, and risk audit.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{bt.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(bt.start_date).toLocaleDateString()} → {new Date(bt.end_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">{bt.strategy_key}</Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetricCard label="Total Trades" value={String(bt.total_trades)} icon={<Activity className="h-4 w-4" />} />
                <MetricCard label="Win Rate" value={`${Number(bt.win_rate ?? 0).toFixed(1)}%`} variant="profit" icon={<Target className="h-4 w-4" />} />
                <MetricCard label="Profit Factor" value={String(Number(bt.profit_factor ?? 0).toFixed(2))} variant="profit" icon={<TrendingUp className="h-4 w-4" />} />
                <MetricCard label="Max Drawdown" value={`${Number(bt.max_drawdown ?? 0).toFixed(2)}%`} variant="warning" icon={<AlertTriangle className="h-4 w-4" />} />
                <MetricCard label="Net Profit" value={`$${Number(bt.net_profit ?? 0).toLocaleString()}`} variant={Number(bt.net_profit ?? 0) >= 0 ? 'profit' : 'loss'} icon={<DollarSign className="h-4 w-4" />} />
                <MetricCard label="Sharpe" value={String(Number(bt.sharpe_ratio ?? 0).toFixed(2))} icon={<BarChart3 className="h-4 w-4" />} />
              </div>

              <Tabs defaultValue="equity" className="w-full">
                <TabsList>
                  <TabsTrigger value="equity">Equity curve</TabsTrigger>
                  <TabsTrigger value="trades">Trades ({trades.length})</TabsTrigger>
                  <TabsTrigger value="audit">Risk audit ({audits.length})</TabsTrigger>
                  <TabsTrigger value="params">Parameters</TabsTrigger>
                </TabsList>

                <TabsContent value="equity" className="mt-4">
                  <div className="trading-card">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={(bt.equity_curve as { ts: string; equity: number }[]) ?? []}>
                          <defs>
                            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                          <XAxis dataKey="ts" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 52%)' }}
                            tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 52%)' }}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} domain={['dataMin - 100', 'dataMax + 100']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 14%, 18%)', borderRadius: '8px', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                            labelStyle={{ color: 'hsl(215, 15%, 52%)' }}
                            formatter={(v: number) => [`$${v.toLocaleString()}`, 'Equity']}
                          />
                          <Area type="monotone" dataKey="equity" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#equityGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="trades" className="mt-4">
                  <div className="trading-card p-0 overflow-hidden">
                    {trades.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No trades for this run.</p>
                    ) : (
                      <ScrollArea className="h-[480px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entry</TableHead>
                              <TableHead>Side</TableHead>
                              <TableHead className="text-right">Entry px</TableHead>
                              <TableHead className="text-right">Exit px</TableHead>
                              <TableHead className="text-right">Lot</TableHead>
                              <TableHead className="text-right">PnL</TableHead>
                              <TableHead className="text-right">R</TableHead>
                              <TableHead>Close</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trades.map((t) => {
                              const pnl = Number(t.pnl ?? 0);
                              return (
                                <TableRow key={t.id}>
                                  <TableCell className="font-mono text-xs">{new Date(t.entry_time).toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant={t.side === 'LONG' ? 'default' : 'secondary'} className="font-mono text-[10px]">
                                      {t.side}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs">{Number(t.entry_price).toFixed(5)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{t.exit_price != null ? Number(t.exit_price).toFixed(5) : '—'}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{Number(t.lot_size).toFixed(2)}</TableCell>
                                  <TableCell className={`text-right font-mono text-xs ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs">{t.r_multiple != null ? Number(t.r_multiple).toFixed(2) : '—'}</TableCell>
                                  <TableCell className="font-mono text-[11px] text-muted-foreground">{t.close_reason ?? '—'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard label="Evaluations" value={String(audits.length)} icon={<Activity className="h-4 w-4" />} />
                    <MetricCard label="Approved" value={String(approvedCount)} variant="profit" icon={<ShieldCheck className="h-4 w-4" />} />
                    <MetricCard label="Rejected" value={String(rejectedCount)} variant="loss" icon={<ShieldAlert className="h-4 w-4" />} />
                    <MetricCard
                      label="Approval rate"
                      value={audits.length ? `${((approvedCount / audits.length) * 100).toFixed(1)}%` : '—'}
                      icon={<Target className="h-4 w-4" />}
                    />
                  </div>

                  <div className="trading-card">
                    <h3 className="text-sm font-semibold mb-3">Per-rule pass / fail</h3>
                    {ruleStats.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rule evaluations recorded for this run.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rule</TableHead>
                            <TableHead className="text-right">Pass</TableHead>
                            <TableHead className="text-right">Fail</TableHead>
                            <TableHead className="text-right">Fail rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ruleStats.map(([rule, s]) => {
                            const total = s.pass + s.fail;
                            const failRate = total ? (s.fail / total) * 100 : 0;
                            return (
                              <TableRow key={rule}>
                                <TableCell className="font-mono text-xs">{rule}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-profit">{s.pass}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-loss">{s.fail}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{failRate.toFixed(1)}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  <div className="trading-card p-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Recent evaluations</h3>
                      <span className="text-[11px] text-muted-foreground">Showing last 50</span>
                    </div>
                    <ScrollArea className="h-[420px]">
                      <ul className="divide-y divide-border/60">
                        {audits.slice(-50).reverse().map((a) => {
                          const rules = (a.rules as RuleAudit[]) ?? [];
                          const failed = rules.filter((r) => r.status === 'fail');
                          return (
                            <li key={a.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {a.approved ? (
                                      <Badge className="bg-profit/15 text-profit border border-profit/30 text-[10px]">APPROVED</Badge>
                                    ) : (
                                      <Badge className="bg-loss/15 text-loss border border-loss/30 text-[10px]">REJECTED</Badge>
                                    )}
                                    <span className="text-[11px] font-mono text-muted-foreground">{new Date(a.ts).toLocaleString()}</span>
                                    <Badge variant="outline" className="font-mono text-[10px]">{a.side}</Badge>
                                  </div>
                                  {!a.approved && (
                                    <p className="text-xs mt-1">
                                      <span className="text-loss font-mono">{a.rejection_reason}</span>
                                      {failed[0]?.detail && <span className="text-muted-foreground"> — {failed[0].detail}</span>}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {rules.map((r, idx) => (
                                      <span
                                        key={idx}
                                        title={`${r.detail}${r.threshold !== undefined ? ` (limit: ${r.threshold}, actual: ${r.actual})` : ''}`}
                                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                          r.status === 'pass' ? 'border-profit/30 text-profit bg-profit/10'
                                          : r.status === 'fail' ? 'border-loss/30 text-loss bg-loss/10'
                                          : 'border-border text-muted-foreground'
                                        }`}
                                      >
                                        {r.rule}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="params" className="mt-4">
                  <div className="trading-card">
                    <h3 className="text-sm font-semibold mb-3">Run parameters</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs font-mono">
                      {Object.entries((bt.config as Record<string, unknown>) ?? {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 border-b border-border/40 py-1">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
