// MT5 Bridge Probe — read-only health check.
// Calls GET /health, /account, /quote on the configured MT5 bridge.
// Returns "not_configured" until MT5_BRIDGE_URL + MT5_BRIDGE_TOKEN are set.
// NEVER places orders. Safe to call from the UI on an interval.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ProbeResult = {
  ok: boolean;
  configured: boolean;
  https: boolean;
  bridge_url?: string;
  checked_at: string;
  health?: { ok: boolean; status?: number; latency_ms?: number; error?: string };
  account?: { ok: boolean; balance?: number; equity?: number; currency?: string; login?: string | number; error?: string };
  quote?: { ok: boolean; symbol?: string; bid?: number; ask?: number; spread_pips?: number; error?: string };
  error?: string;
};

async function timedFetch(url: string, init: RequestInit, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const latency_ms = Math.round(performance.now() - start);
    return { res, latency_ms };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const checked_at = new Date().toISOString();
  const bridgeUrl = Deno.env.get('MT5_BRIDGE_URL');
  const bridgeToken = Deno.env.get('MT5_BRIDGE_TOKEN');
  const symbol = (await req.json().catch(() => ({})))?.symbol ?? 'EURUSD';

  // Not configured → return placeholder, log nothing destructive.
  if (!bridgeUrl || !bridgeToken) {
    const result: ProbeResult = {
      ok: false,
      configured: false,
      https: false,
      checked_at,
      error: 'MT5 bridge not configured. Add MT5_BRIDGE_URL and MT5_BRIDGE_TOKEN secrets.',
    };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const base = bridgeUrl.replace(/\/$/, '');
  const https = base.startsWith('https://');
  const headers = { Authorization: `Bearer ${bridgeToken}`, 'Content-Type': 'application/json' };
  const result: ProbeResult = { ok: false, configured: true, https, bridge_url: base, checked_at };

  // /health
  try {
    const { res, latency_ms } = await timedFetch(`${base}/health`, { headers });
    const body = await res.json().catch(() => ({}));
    result.health = { ok: res.ok, status: res.status, latency_ms, ...(res.ok ? {} : { error: body?.error ?? res.statusText }) };
  } catch (e) {
    result.health = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // /account
  try {
    const { res } = await timedFetch(`${base}/account`, { headers });
    const body = await res.json().catch(() => ({}));
    result.account = res.ok
      ? { ok: true, balance: body.balance, equity: body.equity, currency: body.currency, login: body.login }
      : { ok: false, error: body?.error ?? res.statusText };
  } catch (e) {
    result.account = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // /quote?symbol=EURUSD
  try {
    const { res } = await timedFetch(`${base}/quote?symbol=${encodeURIComponent(symbol)}`, { headers });
    const body = await res.json().catch(() => ({}));
    if (res.ok && typeof body.bid === 'number' && typeof body.ask === 'number') {
      const spread_pips = +(((body.ask - body.bid) * 10000)).toFixed(2);
      result.quote = { ok: true, symbol, bid: body.bid, ask: body.ask, spread_pips };
    } else {
      result.quote = { ok: false, symbol, error: body?.error ?? res.statusText };
    }
  } catch (e) {
    result.quote = { ok: false, symbol, error: e instanceof Error ? e.message : String(e) };
  }

  result.ok = !!(result.health?.ok && result.account?.ok && result.quote?.ok);

  // Log probe to events (read-only audit trail).
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    await supabase.from('events').insert({
      type: 'info',
      stage: 'bridge',
      message: result.ok
        ? `MT5 bridge OK — bal ${result.account?.balance} ${result.account?.currency}, ${symbol} spread ${result.quote?.spread_pips}p`
        : `MT5 bridge probe failed`,
      payload: result as unknown as Record<string, unknown>,
    });
  } catch { /* best-effort */ }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
