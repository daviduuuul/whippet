'use strict';
/*
 * deps-audit value eval — precision/recall of the native-equivalent check on a
 * LABELED corpus of realistic dependency choices (benchmarks are law). Each case
 * declares deps with a ground-truth label (needless_native vs legit) and an
 * engines.node floor; we materialize the package.json, run deps-audit, and score
 * whether the engine's 'native' findings match the labels.
 *
 * Disagreements are the actionable output:
 *   FN = labeled needless_native, engine missed it  -> a recall gap (swap not in tables)
 *   FP = labeled legit, engine flagged it            -> a precision gap (false positive)
 * Both feed an adversarial verification pass (engine bug vs corpus mislabel).
 *
 *   node eval.js <corpus.json>   score, print metrics + disagreements, write disagreements.json
 *   node eval.js --selftest      validate the scorer on a tiny built-in corpus (no corpus file)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { audit } = require('../../whippet/scripts/deps-audit');

function scoreCase(c) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-eval-'));
  const deps = {};
  for (const d of c.deps) deps[d.name] = '*';
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'x', version: '1.0.0', engines: { node: c.engines_node }, dependencies: deps }, null, 2));
  // reference every dep so the 'unused' check never fires — isolates the native check
  const src = c.deps.map((d, i) => `const _${i} = require(${JSON.stringify(d.name)});`).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'index.js'), src);
  const findings = audit(dir).findings;
  fs.rmSync(dir, { recursive: true, force: true });
  const flagged = new Set(
    findings.filter(f => f.category === 'native')
      .map(f => (f.title.match(/native equivalent available: (\S+)/) || [])[1])
      .filter(Boolean)
  );
  return c.deps.map(d => ({
    case: c.id, stack: c.stack, engines: c.engines_node, name: d.name, truth: d.truth,
    flagged: flagged.has(d.name), native: d.native, since_node: d.since_node, reason: d.reason,
  }));
}

function metrics(rows) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const pos = r.truth === 'needless_native';
    if (pos && r.flagged) tp++;
    else if (pos && !r.flagged) fn++;
    else if (!pos && r.flagged) fp++;
    else tn++;
  }
  return { tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 };
}

function run(corpusPath) {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const rows = corpus.cases.flatMap(scoreCase);
  const m = metrics(rows);
  const fns = rows.filter(r => r.truth === 'needless_native' && !r.flagged);
  const fps = rows.filter(r => r.truth === 'legit' && r.flagged);
  console.log(`cases=${corpus.cases.length}  deps=${rows.length}`);
  console.log(`TP=${m.tp} FP=${m.fp} FN=${m.fn} TN=${m.tn}`);
  console.log(`precision=${(m.precision * 100).toFixed(1)}%   recall=${(m.recall * 100).toFixed(1)}%`);
  console.log(`\nFN (recall gaps — labeled needless_native, engine missed): ${fns.length}`);
  for (const r of fns) console.log(`  ${r.name} @${r.engines} -> ${r.native || '?'} (since ${r.since_node}) :: ${r.reason}`);
  console.log(`\nFP (precision gaps — labeled legit, engine flagged): ${fps.length}`);
  for (const r of fps) console.log(`  ${r.name} @${r.engines} :: ${r.reason}`);
  fs.writeFileSync(path.join(path.dirname(corpusPath), 'disagreements.json'),
    JSON.stringify({ metrics: m, fns, fps }, null, 2));
}

function selftest() {
  const corpus = { cases: [
    { id: 't0', stack: 'x', engines_node: '>=22', deps: [
      { name: 'left-pad', truth: 'needless_native', native: 'padStart', since_node: 8, reason: '' },
      { name: 'express', truth: 'legit', native: '', since_node: 0, reason: 'web framework' },
    ] },
    { id: 't1', stack: 'x', engines_node: '>=18', deps: [
      { name: 'dotenv', truth: 'legit', native: '', since_node: 0, reason: 'native only Node 21+' },
    ] },
  ] };
  const rows = corpus.cases.flatMap(scoreCase);
  let ok = true;
  const say = (c, n) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) ok = false; };
  const get = (n) => rows.find(r => r.name === n);
  say(get('left-pad').flagged, 'left-pad on Node 22 flagged (TP)');
  say(!get('express').flagged, 'express not flagged (TN)');
  say(!get('dotenv').flagged, 'dotenv on Node 18 not flagged — gated (TN)');
  const m = metrics(rows);
  say(m.precision === 1 && m.recall === 1, 'tiny corpus: precision=recall=1');
  return ok;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--selftest')) process.exit(selftest() ? 0 : 1);
  if (!a[0]) { console.error('usage: node eval.js <corpus.json> | --selftest'); process.exit(2); }
  run(a[0]);
}
module.exports = { scoreCase, metrics };
