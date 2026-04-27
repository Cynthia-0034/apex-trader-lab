#!/usr/bin/env node
// Build-time guard: ensures every directory under supabase/functions/ is a
// valid edge-function slug AND is declared in supabase/config.toml.
// Fails fast with a clear, actionable message — prevents the
// "slug: Invalid" deploy error caused by helper folders like `_shared`.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';
const CONFIG_PATH = 'supabase/config.toml';

// Supabase slug rules: lowercase letters, digits, hyphens. Must start with a letter.
const SLUG_RE = /^[a-z][a-z0-9-]*$/;

function fail(msg) {
  console.error('\n\x1b[31m✗ Edge function guard failed\x1b[0m');
  console.error(msg);
  console.error('\nFix: rename or remove the offending folder, or declare it under [functions.<name>] in supabase/config.toml.\n');
  process.exit(1);
}

if (!existsSync(FUNCTIONS_DIR)) {
  console.log('✓ No supabase/functions directory — skipping check.');
  process.exit(0);
}

const entries = readdirSync(FUNCTIONS_DIR).filter((name) => {
  const p = join(FUNCTIONS_DIR, name);
  return statSync(p).isDirectory();
});

// Parse declared function slugs from config.toml ([functions.<slug>])
const config = existsSync(CONFIG_PATH) ? readFileSync(CONFIG_PATH, 'utf8') : '';
const declared = new Set(
  [...config.matchAll(/^\s*\[functions\.([a-z0-9-]+)\]/gm)].map((m) => m[1])
);

const invalid = [];
const undeclared = [];
const missingEntry = [];

for (const name of entries) {
  if (!SLUG_RE.test(name)) {
    invalid.push(name);
    continue;
  }
  if (declared.size > 0 && !declared.has(name)) {
    undeclared.push(name);
  }
  if (!existsSync(join(FUNCTIONS_DIR, name, 'index.ts'))) {
    missingEntry.push(name);
  }
}

const problems = [];
if (invalid.length) {
  problems.push(
    `  • Invalid slug(s): ${invalid.map((n) => `"${n}"`).join(', ')}\n` +
    `    Slugs must match /^[a-z][a-z0-9-]*$/ (no underscores, no leading digits).\n` +
    `    Helper code (e.g. "_shared", "_lib") must NOT live as a top-level folder under supabase/functions/.`
  );
}
if (undeclared.length) {
  problems.push(
    `  • Undeclared function(s) in ${CONFIG_PATH}: ${undeclared.map((n) => `"${n}"`).join(', ')}\n` +
    `    Add a [functions.<name>] block for each, or remove the folder.`
  );
}
if (missingEntry.length) {
  problems.push(
    `  • Missing index.ts in: ${missingEntry.map((n) => `"${n}"`).join(', ')}`
  );
}

if (problems.length) fail(problems.join('\n\n'));

console.log(`✓ Edge function guard OK — ${entries.length} function(s) validated: ${entries.join(', ')}`);
