#!/usr/bin/env node
// Objectively score one arm's solution to a fixture: correctness (hard gate),
// LOC/files added, dependencies added, reuse of the flagged helper.
// Usage: node scripts/bench-score.js <fixture-id> <arm> <candidate-dir> [--model M] [--save]
// --save appends the observation to benchmarks/results/runs.jsonl; else prints it.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

// Size: non-empty lines in files that are new or changed vs before.
let loc_added = 0;
for (const f of candFiles) {
  const c = read(candDir, f), b = read(beforeDir, f);
  if (b === null) loc_added += nonEmptyLines(c);
  else if (c !== b) loc_added += Math.max(0, nonEmptyLines(c) - nonEmptyLines(b));
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

// Reuse: did the candidate reference the flagged helper?
const reused = meta.reuse_marker
  ? candFiles.some((f) => (read(candDir, f) || '').includes(meta.reuse_marker))
  : undefined;

// Correctness: the hidden grader passes. Hard gate.
let correct = false;
try {
  execFileSync(process.execPath, [path.join(fxDir, meta.grader)], { env: { ...process.env, CANDIDATE: candDir }, stdio: 'pipe' });
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
