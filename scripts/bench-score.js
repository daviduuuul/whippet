#!/usr/bin/env node
// Objectively score one arm's solution to a fixture: correctness (hard gate),
// LOC/files added, dependencies added, reuse of the flagged helper.
// Usage: node scripts/bench-score.js <fixture-id> <arm> <candidate-dir> [--model M] [--save]
// --save appends the observation to benchmarks/results/runs.jsonl; else prints it.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Lines added OR changed vs before — a net-delta count misses an in-place rewrite
// (`return 1` → `return compute()` is the same line count but a real change), and
// LOC is the only axis with spread, so it has to be honest. Multiset of before's
// non-empty trimmed lines; each candidate line not matched by an identical before
// line is an add/change.
function countChangedLines(before, after) {
  const pool = {};
  for (const l of (before || '').split('\n')) { const t = l.trim(); if (t) pool[t] = (pool[t] || 0) + 1; }
  let n = 0;
  for (const l of (after || '').split('\n')) { const t = l.trim(); if (!t) continue; if (pool[t] > 0) pool[t]--; else n++; }
  return n;
}

// Did the candidate reference the marker in CODE, not just a comment? Strips line
// comments first — a bare substring match counts a `// see ./utils` mention, which
// METHODOLOGY's "did it call the helper" must not.
function usesMarker(code, marker) {
  return (code || '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').includes(marker);
}

if (process.argv[2] === 'selftest') {
  const assert = require('node:assert/strict');
  assert.equal(countChangedLines('function f(){\n  return 1;\n}', 'function f(){\n  return compute();\n}'), 1, 'in-place rewrite counts as 1, not 0');
  assert.equal(countChangedLines('a', 'a\nb\nc'), 2, 'additions count per line');
  assert.equal(countChangedLines('a\nb', 'a\n\nb'), 0, 'blank-only change counts 0');
  assert.equal(usesMarker("import x from './utils'", './utils'), true);
  assert.equal(usesMarker('// reuse ./utils later', './utils'), false, 'a comment mention is not reuse');
  console.log('bench-score selftest: pass');
  process.exit(0);
}

const [fixtureId, arm, candidate] = process.argv.slice(2);
if (!fixtureId || !arm || !candidate) {
  console.error('Usage: node scripts/bench-score.js <fixture-id> <arm> <candidate-dir> [--model M] [--save]');
  process.exit(1);
}
const flag = (name) => { const i = process.argv.indexOf(name); return i > -1 ? (process.argv[i + 1] || true) : null; };
const model = flag('--model') || 'unknown';
const save = process.argv.includes('--save');

const root = path.join(__dirname, '..');
const fxDir = path.join(root, 'benchmarks/fixtures', fixtureId);
const meta = JSON.parse(fs.readFileSync(path.join(fxDir, 'meta.json'), 'utf8'));
const beforeDir = path.join(fxDir, 'before');
const candDir = path.resolve(candidate);

// Recursively list relative file paths under a dir (skip junk).
const walk = (base, rel = '', out = []) => {
  for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) walk(base, r, out);
    else out.push(r.replace(/\\/g, '/'));
  }
  return out;
};
const read = (d, f) => { try { return fs.readFileSync(path.join(d, f), 'utf8'); } catch { return null; } };
const nonEmptyLines = (s) => s.split('\n').filter((l) => l.trim()).length;

const beforeFiles = walk(beforeDir);
const candFiles = walk(candDir);

// Size: lines added or changed vs before (counts in-place rewrites; see
// countChangedLines). A net-delta count would under-report every edit that keeps
// the line total.
let loc_added = 0;
for (const f of candFiles) {
  const c = read(candDir, f), b = read(beforeDir, f);
  if (c === null) continue;
  if (b === null) loc_added += nonEmptyLines(c);
  else if (c !== b) loc_added += countChangedLines(b, c);
}
const files_added = candFiles.filter((f) => !beforeFiles.includes(f)).length;

// Dependencies added: new keys in the manifest's deps + devDeps.
const deps = (dir) => {
  const m = read(dir, meta.manifest);
  if (!m) return new Set();
  try { const j = JSON.parse(m); return new Set([...Object.keys(j.dependencies || {}), ...Object.keys(j.devDependencies || {})]); }
  catch { return new Set(); }
};
const before = deps(beforeDir);
const deps_added = [...deps(candDir)].filter((d) => !before.has(d)).length;

// Reuse: did the candidate call the flagged helper (in code, not a comment)?
const reused = meta.reuse_marker
  ? candFiles.some((f) => usesMarker(read(candDir, f) || '', meta.reuse_marker))
  : undefined;

// Correctness: the hidden grader passes. Hard gate.
let correct = false;
try {
  execFileSync(process.execPath, [path.join(fxDir, meta.grader)], { env: { ...process.env, CANDIDATE: candDir }, stdio: 'pipe', timeout: 10000 });
  correct = true;
} catch { correct = false; }

const obs = { task: fixtureId, category: meta.category, arm, model, correct, loc_added, files_added, deps_added };
if (reused !== undefined) obs.reused = reused;

if (save) {
  fs.mkdirSync(path.join(root, 'benchmarks/results'), { recursive: true });
  fs.appendFileSync(path.join(root, 'benchmarks/results/runs.jsonl'), JSON.stringify(obs) + '\n');
  console.log('saved:', JSON.stringify(obs));
} else {
  console.log(JSON.stringify(obs, null, 2));
}
