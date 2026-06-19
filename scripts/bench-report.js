#!/usr/bin/env node
// Aggregate every benchmarks/results/*.json (observations arrays) and *.jsonl
// (one observation per line) into one scoreboard: per-arm rates with a Wilson
// 95% CI, mean numeric metrics, and a per-category correctness split.
// Pure node, no deps. Run: npm run bench
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'benchmarks/results');

// Mean of a numeric field over observations matching a category + arm; null if
// none. Pulled out so the batch_size signal can be read per category (the
// arm-wide means below dilute it) and so it's unit-checkable.
// Run: node scripts/bench-report.js selftest
function perCatMean(observations, cat, arm, key) {
  const vals = observations.filter((o) => o.category === cat && o.arm === arm && typeof o[key] === 'number').map((o) => o[key]);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

if (process.argv[2] === 'selftest') {
  const assert = require('node:assert/strict');
  const t = [
    { category: 'batch_size', arm: 'whippet', loc_added: 10, files_added: 1 },
    { category: 'batch_size', arm: 'whippet', loc_added: 20, files_added: 3 },
    { category: 'batch_size', arm: 'off', loc_added: 80, files_added: 6 },
    { category: 'trap_reuse', arm: 'whippet', loc_added: 4, files_added: 0 },
  ];
  assert.equal(perCatMean(t, 'batch_size', 'whippet', 'loc_added'), 15);
  assert.equal(perCatMean(t, 'batch_size', 'whippet', 'files_added'), 2);
  assert.equal(perCatMean(t, 'batch_size', 'off', 'loc_added'), 80);
  assert.equal(perCatMean(t, 'trap_reuse', 'whippet', 'loc_added'), 4);
  assert.equal(perCatMean(t, 'batch_size', 'baseline', 'loc_added'), null, 'no obs → null, not 0');
  console.log('bench-report selftest: pass');
  process.exit(0);
}

const obs = [];
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f);
  try {
    if (f.endsWith('.jsonl')) fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).forEach((l) => obs.push(JSON.parse(l)));
    else if (f.endsWith('.json')) (JSON.parse(fs.readFileSync(p, 'utf8')).observations || []).forEach((o) => obs.push(o));
  } catch { console.error(`skipped unreadable ${f}`); }
}
if (!obs.length) { console.log('No observations yet. Add a file under benchmarks/results/ or run scripts/bench-score.js --save.'); process.exit(0); }

// good=true  → higher is better; good=false → we report the "clean" rate (value===false).
const BOOL = [
  ['correct', 'Correct (gate)', true],
  ['reused', 'Reused existing / native', true],
  ['ranCheck', 'Left a runnable check', true],
  ['validationOk', 'Kept validation + security', true],
  ['depAdded', 'Avoided an extra dependency', false],
  ['overEngineered', 'Avoided over-engineering', false],
  ['judge_winner', 'Judge win (paired)', true],
];
const NUM = [
  ['loc_added', 'LOC added'], ['files_added', 'Files added'], ['deps_added', 'Deps added'], ['report_tokens', 'Report tokens'],
  ['right_sized', 'Right-sized 1-5 (judge)'], ['dep_justified', 'Dep justified 1-5 (judge)'],
  ['reuse_quality', 'Reuse 1-5 (judge)'], ['terse_complete', 'Terse+complete 1-5 (judge)'],
];
const arms = ['whippet', 'baseline', 'off'].filter((a) => obs.some((o) => o.arm === a));

// Wilson 95% interval for a binomial proportion (z=1.96).
const wilson = (k, n) => {
  const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / d;
  return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
};
const pct = (n) => n.toFixed(0);

const cell = (arm, key, good) => {
  const vals = obs.filter((o) => o.arm === arm && typeof o[key] === 'boolean');
  if (!vals.length) return '—';
  const k = vals.filter((o) => o[key] === good).length;
  const [lo, hi] = wilson(k, vals.length);
  return `${k}/${vals.length} (${pct(lo)}–${pct(hi)}%)`;
};
const numCell = (arm, key) => {
  const vals = obs.filter((o) => o.arm === arm && typeof o[key] === 'number').map((o) => o[key]);
  if (!vals.length) return '—';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};

const header = (cols) => `| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|`;

console.log(`# Benchmark scoreboard\n`);
console.log(`${obs.length} observations · arms: ${arms.join(', ')}. Rates show good/total with a Wilson 95% CI.\n`);

const boolRows = BOOL.filter(([key]) => obs.some((o) => typeof o[key] === 'boolean'));
if (boolRows.length) {
  console.log(header(['Signal', ...arms]));
  for (const [key, label, good] of boolRows)
    console.log(`| ${label} | ${arms.map((a) => cell(a, key, good)).join(' | ')} |`);
  console.log('');
}

const numRows = NUM.filter(([key]) => obs.some((o) => typeof o[key] === 'number'));
if (numRows.length) {
  console.log(`**Means**\n`);
  console.log(header(['Metric', ...arms]));
  for (const [key, label] of numRows)
    console.log(`| ${label} | ${arms.map((a) => numCell(a, key)).join(' | ')} |`);
  console.log('');
}

// Per-category correctness split (Simpson's-paradox guard).
const cats = [...new Set(obs.filter((o) => o.category && typeof o.correct === 'boolean').map((o) => o.category))];
if (cats.length) {
  console.log(`**Correct by category**\n`);
  console.log(header(['Category', ...arms]));
  for (const cat of cats) {
    const inCat = (arm) => {
      const vals = obs.filter((o) => o.category === cat && o.arm === arm && typeof o.correct === 'boolean');
      if (!vals.length) return '—';
      return `${vals.filter((o) => o.correct).length}/${vals.length}`;
    };
    console.log(`| ${cat} | ${arms.map(inCat).join(' | ')} |`);
  }
}

// Per-category diff size — the batch_size signal the arm-wide means above hide.
const DIFF = [['loc_added', 'LOC'], ['files_added', 'files']];
const catsNum = [...new Set(obs.filter((o) => o.category && DIFF.some(([k]) => typeof o[k] === 'number')).map((o) => o.category))];
if (catsNum.length) {
  console.log(`\n**Diff size by category** (mean ${DIFF.map(([, l]) => l).join(' / ')})\n`);
  console.log(header(['Category', ...arms]));
  for (const cat of catsNum) {
    const fmt = (arm) => {
      const parts = DIFF.map(([key]) => { const m = perCatMean(obs, cat, arm, key); return m === null ? '—' : m.toFixed(1); });
      return parts.every((p) => p === '—') ? '—' : parts.join(' / ');
    };
    console.log(`| ${cat} | ${arms.map(fmt).join(' | ')} |`);
  }
}
