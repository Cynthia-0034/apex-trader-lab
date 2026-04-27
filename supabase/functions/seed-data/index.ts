// Apex Engine — Seed mock EURUSD H1 candles into the data engine.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const count = Math.min(2000, Math.max(300, body.count ?? 1000));
    const pair = body.pair ?? 'EURUSD';
    const timeframe = body.timeframe ?? 'H1';

    let price = 1.085;
    const start = new Date(Date.now() - count * 3600000);
    const rows = [];
    for (let i = 0; i < count; i++) {
      // Random walk with slight trend cycles
      const trendBias = Math.sin(i / 40) * 0.0002;
      const change = (Math.random() - 0.5) * 0.0025 + trendBias;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 0.0008;
      const low = Math.min(open, close) - Math.random() * 0.0008;
      price = close;
      rows.push({
        pair, timeframe,
        ts: new Date(start.getTime() + i * 3600000).toISOString(),
        open: +open.toFixed(5), high: +high.toFixed(5),
        low: +low.toFixed(5), close: +close.toFixed(5),
        volume: Math.floor(1000 + Math.random() * 5000),
        spread: +(0.8 + Math.random() * 0.8).toFixed(2),
        source: 'mock',
      });
    }

    // Clear existing mock data for this pair/tf, then insert
    await supabase.from('candles').delete().eq('pair', pair).eq('timeframe', timeframe).eq('source', 'mock');
    // Insert in chunks
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const { error } = await supabase.from('candles').insert(rows.slice(i, i + chunkSize));
      if (error) throw error;
    }

    await supabase.from('events').insert({
      type: 'info', stage: 'data_engine',
      message: `Seeded ${rows.length} ${timeframe} ${pair} candles (mock data)`,
      payload: { count: rows.length },
    });

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
