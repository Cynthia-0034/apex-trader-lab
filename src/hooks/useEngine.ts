// React Query hooks bound to the Apex Engine pipeline tables.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useActiveConfig() {
  return useQuery({
    queryKey: ['config', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configs').select('*').eq('active', true).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useEvents(limit = 20) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel('events-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' },
        () => qc.invalidateQueries({ queryKey: ['events'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ['events', limit],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').order('ts', { ascending: false }).limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useTrades() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel('trades-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' },
        () => qc.invalidateQueries({ queryKey: ['trades'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ['trades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trades').select('*').order('entry_time', { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export function useSignals(limit = 50) {
  return useQuery({
    queryKey: ['signals', limit],
    queryFn: async () => {
      const { data, error } = await supabase.from('signals').select('*').order('ts', { ascending: false }).limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useLatestBacktest() {
  return useQuery({
    queryKey: ['backtest', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase.from('backtests').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCandleCount() {
  return useQuery({
    queryKey: ['candles', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('candles').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useSeedData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (count: number = 1000) => {
      const { data, error } = await supabase.functions.invoke('seed-data', { body: { count } });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Seeded ${d.inserted} candles`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(`Seed failed: ${e.message}`),
  });
}

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('run-pipeline');
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      if (d?.error) { toast.error(d.error); return; }
      if (d?.trade) toast.success(`Trade executed: ${d.signal.side} @ ${d.trade.entry_price}`);
      else if (d?.decision && !d.decision.approved) toast.warning(`Signal rejected: ${d.decision.reason}`);
      else if (d?.signal) toast.info(`Signal generated: ${d.signal.side}`);
      else toast.message('No signal this bar');
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(`Pipeline error: ${e.message}`),
  });
}

export function useRunBacktest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => {
      const { data, error } = await supabase.functions.invoke('run-backtest', { body: { name } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Backtest complete: ${d.metrics.total_trades} trades, ${d.metrics.win_rate}% win rate`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(`Backtest failed: ${e.message}`),
  });
}

export function useToggleKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kill: boolean) => {
      const { data, error } = await supabase.functions.invoke('toggle-kill-switch', { body: { kill_switch: kill } });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, kill) => {
      toast[kill ? 'warning' : 'success'](`Kill switch ${kill ? 'ACTIVATED' : 'deactivated'}`);
      qc.invalidateQueries();
    },
  });
}
