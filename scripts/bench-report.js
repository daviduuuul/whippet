#!/usr/bin/env node
// Aggregate every benchmarks/results/*.json (observations arrays) and *.jsonl
// (one observation per line) into one scoreboard: per-arm rates with a Wilson
// 95% CI, mean numeric metrics, and a per-category correctness split.
// Pure node, no deps. Run: npm run bench
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'benchmarks/results');

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
];
const NUM = [['loc_added', 'LOC added'], ['files_added', 'Files added'], ['deps_added', 'Deps added'], ['report_tokens', 'Report tokens']];
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
