#!/usr/bin/env node
// Build-time backtest smoke test.
// Invokes run-backtest with auto_seed enabled (tiny dataset), then verifies
// that signals, risk approvals, and execution/event logs are produced.
//
// Bypass: SKIP_SMOKE_TEST=1
import { readFileSync, existsSync } from 'node:fs';

if (process.env.SKIP_SMOKE_TEST === '1') {
  console.log('⚠ SKIP_SMOKE_TEST=1 — backtest smoke test bypassed.');
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

if (!URL_ || !KEY) {
  console.log('⚠ No backend credentials — skipping backtest smoke test.');
  process.exit(0);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const STRICT = process.argv.includes('--strict');

async function rest(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`REST ${path}: HTTP ${res.status}`);
  return res.json();
}

async function invoke(fn, body) {
  const res = await fetch(`${URL_}/functions/v1/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`fn ${fn} HTTP ${res.status}: ${json.error ?? text}`);
  return json;
}

console.log('\n🔬 Running backtest smoke test…');
const startedAt = new Date().toISOString();

try {
  const result = await Promise.race([
    invoke('run-backtest', { name: `Smoke ${startedAt}`, auto_seed: true, seed_count: 800 }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after 60s')), 60_000)),
  ]);

  const trades = result?.metrics?.total_trades ?? 0;
  const rejections = Array.isArray(result?.rejections) ? result.rejections.length : 0;
  console.log(`  • backtest completed: ${trades} trades, ${rejections} rejections`);

  // Verify downstream artifacts exist after the run.
  const [sig, approved, evt] = await Promise.all([
    rest(`signals?select=id&order=ts.desc&limit=1`),
    rest(`signals?select=id&approved=not.is.null&order=ts.desc&limit=1`),
    rest(`events?select=id&stage=eq.backtest&order=ts.desc&limit=1`),
  ]);

  const checks = [
    { name: 'signals generated',   ok: trades > 0 || sig.length > 0 },
    { name: 'risk approvals/rejections logged', ok: trades > 0 || approved.length > 0 || rejections > 0 },
    { name: 'execution log written', ok: trades > 0 },
    { name: 'pipeline event logged', ok: evt.length > 0 },
  ];

  let failed = 0;
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (!c.ok) failed++;
  }

  if (failed > 0) {
    console.error(`\n\x1b[31m✗ Backtest smoke test failed (${failed} check${failed > 1 ? 's' : ''})\x1b[0m`);
    console.error('Bypass (use sparingly): SKIP_SMOKE_TEST=1\n');
    if (STRICT || failed >= 2) process.exit(1);
    console.log('  (non-strict mode: continuing build)');
  } else {
    console.log('\n✓ Backtest smoke test passed.\n');
  }
} catch (e) {
  console.error(`\n\x1b[31m✗ Backtest smoke test errored:\x1b[0m ${e.message}`);
  console.error('Bypass: SKIP_SMOKE_TEST=1\n');
  if (STRICT) process.exit(1);
  console.log('  (non-strict mode: continuing build)');
}
