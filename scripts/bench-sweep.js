#!/usr/bin/env node
'use strict';
/*
 * bench-sweep — reproducible model-tier sweep runner. Loops models × arms × fixtures
 * × n: copies the fixture's before/ into .staging/, generates a candidate with
 * `claude -p --model <id>` (arm prefix + the task), then scores it deterministically
 * with bench-score.js (--save appends to runs.jsonl).
 *
 * THIS MAKES PAID MODEL CALLS and needs the `claude` CLI — it does NOT run in CI.
 * `node scripts/bench-sweep.js selftest` (alias --dry-run) prints the planned matrix
 * and asserts the cell/run counts with no model calls; that is what npm test runs.
 *
 * Arm prefixes are byte-identical to the 2026-06-19 Opus run, so the only varied
 * factor is the model (benchmarks/results/2026-06-19-opus-ab.md:13-15).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { buildPayload } = require('../whippet/hooks/whippet-core.js');

const root = path.join(__dirname, '..');

// VERIFY these IDs + the --model flag at runtime (`claude --help` / the claude-api
// skill) before a real run — a wrong/aliased id silently runs the wrong tier.
const MODELS = {
  'claude-haiku-4-5-20251001': 'all',  // weakest tier — strongest bloat prior
  'claude-sonnet-4-6': 'all',          // mid tier
  'claude-opus-4-8': 'new',            // already has the 5 public fixtures at n=5; only the 2 new ones
};
const FIXTURES_EXISTING = ['reuse-slugify', 'stdlib-uuid', 'yagni-config', 'overcut-validation', 'batch-multistep'];
const FIXTURES_NEW = ['overcut-parse-2', 'batch-refactor'];
const FIXTURES_ALL = [...FIXTURES_EXISTING, ...FIXTURES_NEW];
const ARMS = ['off', 'baseline', 'whippet'];
const N = 8;

const ARM_PREFIX = {
  off: 'Solve it as a competent dev normally would; explicitly ignore any lean/whippet discipline.',
  baseline: 'Write minimal code that works; reuse existing/stdlib/native before adding code or deps; report tersely.',
  whippet: buildPayload('full'),
};

const fixturesFor = (scope) => (scope === 'all' ? FIXTURES_ALL : FIXTURES_NEW);

// One cell per (model, fixture, arm); n runs each.
function matrix() {
  const cells = [];
  for (const [model, scope] of Object.entries(MODELS))
    for (const fixture of fixturesFor(scope))
      for (const arm of ARMS)
        cells.push({ model, fixture, arm, n: N });
  return cells;
}

if (process.argv[2] === 'selftest' || process.argv.includes('--dry-run')) {
  const assert = require('node:assert/strict');
  const cells = matrix();
  const runs = cells.reduce((a, c) => a + c.n, 0);
  const byModel = {};
  for (const c of cells) byModel[c.model] = (byModel[c.model] || 0) + c.n;
  console.log('model-tier sweep — planned matrix');
  for (const [m, scope] of Object.entries(MODELS))
    console.log(`  ${m} (${scope}): ${fixturesFor(scope).length} fixtures × ${ARMS.length} arms × ${N} = ${byModel[m]} runs`);
  console.log(`  total: ${cells.length} cells, ${runs} runs`);
  assert.equal(cells.length, 48, 'expected 48 cells (haiku 21 + sonnet 21 + opus 6)');
  assert.equal(runs, 384, 'expected 384 runs (336 across the 2 new models + 48 Opus on the 2 new fixtures)');
  console.log('bench-sweep selftest: pass');
  process.exit(0);
}

// --- real run (paid; needs `claude`) ---
if (spawnSync('claude', ['--version'], { stdio: 'ignore' }).status !== 0) {
  console.error('bench-sweep: the `claude` CLI is not available here. Run this on a machine with');
  console.error('Claude Code installed. `node scripts/bench-sweep.js selftest` checks the matrix offline.');
  process.exit(1);
}

const stage = path.join(root, '.staging', 'sweep');
fs.mkdirSync(stage, { recursive: true });
const copyDir = (src, dst) => {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
};

for (const cell of matrix()) {
  const fxDir = path.join(root, 'benchmarks/fixtures', cell.fixture);
  if (!fs.existsSync(fxDir)) { console.error(`skip: fixture ${cell.fixture} not present locally`); continue; }
  const task = fs.readFileSync(path.join(fxDir, 'task.md'), 'utf8');
  for (let i = 0; i < cell.n; i++) {
    const candDir = path.join(stage, `${cell.model}__${cell.fixture}__${cell.arm}__${i}`);
    copyDir(path.join(fxDir, 'before'), candDir);
    const prompt = `${ARM_PREFIX[cell.arm]}\n\n${task}\n\nEdit the files under ${candDir} to solve it. Do not explain.`;
    try { execFileSync('claude', ['-p', '--model', cell.model], { input: prompt, cwd: candDir, stdio: ['pipe', 'ignore', 'ignore'], timeout: 180000 }); }
    catch { /* a failed generation still gets scored (likely correct:false) */ }
    try { execFileSync(process.execPath, [path.join(root, 'scripts/bench-score.js'), cell.fixture, cell.arm, candDir, '--model', cell.model, '--save'], { stdio: 'inherit' }); }
    catch { /* scoring error: skip this run */ }
  }
}
console.log('sweep complete — aggregate with: npm run bench');

module.exports = { matrix };
