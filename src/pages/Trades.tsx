import { useState } from "react";
import { mockTrades } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

type Filter = 'all' | 'LONG' | 'SHORT' | 'winners' | 'losers';

export default function Trades() {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = mockTrades.filter((t) => {
    if (filter === 'LONG') return t.direction === 'LONG';
    if (filter === 'SHORT') return t.direction === 'SHORT';
    if (filter === 'winners') return (t.pnl ?? 0) > 0;
    if (filter === 'losers') return (t.pnl ?? 0) < 0;
    return true;
  });

  const totalPnl = filtered.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const wins = filtered.filter((t) => (t.pnl ?? 0) > 0).length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
          Trade History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} trades · Win rate: {((wins / filtered.length) * 100).toFixed(1)}% · Net P&L:{" "}
          <span className={totalPnl >= 0 ? "text-profit" : "text-loss"}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </span>
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-2">
        {(['all', 'LONG', 'SHORT', 'winners', 'losers'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-mono transition-colors border",
              filter === f
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            )}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div variants={item} className="trading-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs">ID</TableHead>
              <TableHead className="font-mono text-xs">Time</TableHead>
              <TableHead className="font-mono text-xs">Dir</TableHead>
              <TableHead className="font-mono text-xs">Entry</TableHead>
              <TableHead className="font-mono text-xs">Exit</TableHead>
              <TableHead className="font-mono text-xs">SL</TableHead>
              <TableHead className="font-mono text-xs">TP</TableHead>
              <TableHead className="font-mono text-xs">Lot</TableHead>
              <TableHead className="font-mono text-xs">Pips</TableHead>
              <TableHead className="font-mono text-xs">P&L</TableHead>
              <TableHead className="font-mono text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id} className="hover:bg-accent/30">
                <TableCell className="font-mono text-xs">{t.id}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(t.entryTime).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={t.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] font-mono">
                    {t.direction}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.entryPrice}</TableCell>
                <TableCell className="font-mono text-xs">{t.exitPrice}</TableCell>
                <TableCell className="font-mono text-xs">{t.stopLoss}</TableCell>
                <TableCell className="font-mono text-xs">{t.takeProfit}</TableCell>
                <TableCell className="font-mono text-xs">{t.lotSize}</TableCell>
                <TableCell className={cn("font-mono text-xs", (t.pnlPips ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                  {(t.pnlPips ?? 0) >= 0 ? '+' : ''}{t.pnlPips}
                </TableCell>
                <TableCell className={cn("font-mono text-xs font-medium", (t.pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                  {(t.pnl ?? 0) >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px] font-mono">{t.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </motion.div>
  );
}
