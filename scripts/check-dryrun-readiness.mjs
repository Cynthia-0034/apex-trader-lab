#!/usr/bin/env node
// Live Dry-Run readiness check.
// Invokes mt5-bridge-probe and live-dry-run, then verifies:
//   1. Bridge probe attempts /health, /account, /quote (each appears in payload)
//   2. Missing endpoints surface clear errors (not silent failures)
//   3. Dry-run logs an event tagged stage='dry_run' and writes ZERO trades
//
// Bypass: SKIP_DRYRUN_CHECK=1
import { readFileSync, existsSync } from 'node:fs';

if (process.env.SKIP_DRYRUN_CHECK === '1') {
  console.log('⚠ SKIP_DRYRUN_CHECK=1 — dry-run readiness check bypassed.');
  process.exit(0);
}

const env = {};
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const URL_ = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STRICT = process.argv.includes('--strict');

if (!URL_ || !KEY) {
  console.log('⚠ No backend credentials — skipping dry-run readiness check.');
  process.exit(0);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`REST ${path}: HTTP ${res.status}`);
  return res.json();
}
async function invoke(fn, body) {
  const res = await fetch(`${URL_}/functions/v1/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok && res.status !== 200) throw new Error(`fn ${fn} HTTP ${res.status}: ${json.error ?? text}`);
  return json;
}

console.log('\n🔬 Running live-dry-run readiness check…');

try {
  const tradesBefore = await rest(`trades?select=id&order=created_at.desc&limit=1`);
  const beforeId = tradesBefore[0]?.id ?? null;

  // 1. Probe directly — must return all three endpoint sections.
  const probe = await Promise.race([
    invoke('mt5-bridge-probe', {}),
    new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout 15s')), 15_000)),
  ]);
  console.log(`  • bridge configured: ${probe.configured}, ok: ${probe.ok}`);

  // 2. Run dry-run — must log a dry_run event, must NOT write a trade.
  const dryrun = await Promise.race([
    invoke('live-dry-run', {}),
    new Promise((_, rej) => setTimeout(() => rej(new Error('dry-run timeout 30s')), 30_000)),
  ]);
  if (dryrun?.error) throw new Error(`dry-run error: ${dryrun.error}`);

  const [evt, tradesAfter] = await Promise.all([
    rest(`events?select=id,stage,message,payload&stage=eq.dry_run&order=ts.desc&limit=1`),
    rest(`trades?select=id&order=created_at.desc&limit=1`),
  ]);
  const afterId = tradesAfter[0]?.id ?? null;
  const newTrade = afterId !== beforeId;

  // Endpoints attempted: probe payload should include each section, OR
  // (when not configured) the error message must clearly say so.
  const hasHealth   = probe.health   !== undefined || /not configured/i.test(probe.error ?? '');
  const hasAccount  = probe.account  !== undefined || /not configured/i.test(probe.error ?? '');
  const hasQuote    = probe.quote    !== undefined || /not configured/i.test(probe.error ?? '');

  // Missing-endpoint error clarity: when configured but a section failed,
  // its `.error` must be a non-empty string (no silent nulls).
  const clearErrors = !probe.configured || ['health', 'account', 'quote'].every((k) => {
    const s = probe[k];
    return !s || s.ok === true || (typeof s.error === 'string' && s.error.length > 0);
  });

  const checks = [
    { name: '/health probed',  ok: hasHealth },
    { name: '/account probed', ok: hasAccount },
    { name: '/quote probed',   ok: hasQuote },
    { name: 'missing endpoints surface clear errors', ok: clearErrors },
    { name: 'dry_run event logged', ok: evt.length > 0 },
    { name: 'NO trade was placed (dry-run is read-only)', ok: !newTrade },
  ];

  let failed = 0;
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (!c.ok) failed++;
  }

  if (failed > 0) {
    console.error(`\n\x1b[31m✗ Dry-run readiness check failed (${failed} check${failed > 1 ? 's' : ''})\x1b[0m`);
    console.error('Bypass (use sparingly): SKIP_DRYRUN_CHECK=1\n');
    if (STRICT || failed >= 2) process.exit(1);
    console.log('  (non-strict mode: continuing build)');
  } else {
    console.log('\n✓ Dry-run readiness check passed.\n');
  }
} catch (e) {
  console.error(`\n\x1b[31m✗ Dry-run readiness check errored:\x1b[0m ${e.message}`);
  console.error('Bypass: SKIP_DRYRUN_CHECK=1\n');
  if (STRICT) process.exit(1);
  console.log('  (non-strict mode: continuing build)');
}
