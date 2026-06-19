#!/usr/bin/env node
// Score one POST-COMPACTION trap solved by a drift-test subject session.
// Reuses scripts/bench-score.js for the objective scoring (no logic duplicated);
// adds the drift dimensions (arm / session / compaction) and a per-trap
// `lean_compliant` flag, and appends one observation to drift-runs.jsonl.
//
//   node benchmarks/drift/score-drift.js <trap> <arm> <session> <compaction> <candidate-dir> [--model M]
//   <trap>   reuse | stdlib | yagni | overcut
//   <arm>    A | B | C          (A=paste-once, B=CLAUDE.md, C=whippet)
//   <session>     integer ≥1    (which subject session)
//   <compaction>  integer ≥1    (which /compact within that session)
//
// Pure Node builtins. Run: node benchmarks/drift/score-drift.js selftest
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'drift-runs.jsonl');

// trap → which fixture grades it, and the objective "stayed lean" tell.
// A trap is lean_compliant only if it is BOTH correct AND avoided the bloat the
// trap baits — read off the same objective fields bench-score.js already emits.
const TRAPS = {
  reuse:   { fixture: 'reuse-slugify',      tell: (o) => o.reused === true },
  stdlib:  { fixture: 'stdlib-uuid',        tell: (o) => o.deps_added === 0 },
  yagni:   { fixture: 'yagni-config',       tell: (o) => o.loc_added <= 6 },
  overcut: { fixture: 'overcut-validation', tell: () => true }, // grader fails an over-cut
};

// lean_compliant = correct AND the trap's lean tell holds. Pure, unit-tested.
function classify(trap, obs) {
  const t = TRAPS[trap];
  if (!t) throw new Error(`unknown trap: ${trap}`);
  return Boolean(obs.correct) && Boolean(t.tell(obs));
}

if (process.argv[2] === 'selftest') {
  const assert = require('node:assert/strict');
  assert.equal(classify('stdlib', { correct: true, deps_added: 0 }), true);
  assert.equal(classify('stdlib', { correct: true, deps_added: 1 }), false, 'added a dep → not lean');
  assert.equal(classify('stdlib', { correct: false, deps_added: 0 }), false, 'wrong → never compliant');
  assert.equal(classify('reuse', { correct: true, reused: true }), true);
  assert.equal(classify('reuse', { correct: true, reused: false }), false, 're-implemented → not reuse');
  assert.equal(classify('yagni', { correct: true, loc_added: 2 }), true);
  assert.equal(classify('yagni', { correct: true, loc_added: 18 }), false, 'built an abstraction → not lean');
  assert.equal(classify('overcut', { correct: true }), true);
  assert.equal(classify('overcut', { correct: false }), false);
  assert.throws(() => classify('nope', {}), /unknown trap/);
  console.log('score-drift selftest: pass');
  process.exit(0);
}

const [trap, arm, session, compaction, candidate] = process.argv.slice(2);
if (!trap || !arm || !session || !compaction || !candidate) {
  console.error('Usage: node benchmarks/drift/score-drift.js <trap> <arm> <session> <compaction> <candidate-dir> [--model M]');
  process.exit(1);
}
if (!TRAPS[trap]) { console.error(`unknown trap "${trap}" (reuse|stdlib|yagni|overcut)`); process.exit(1); }
if (!['A', 'B', 'C'].includes(arm)) { console.error(`arm must be A|B|C, got "${arm}"`); process.exit(1); }
const mi = process.argv.indexOf('--model');
const model = mi > -1 ? process.argv[mi + 1] : 'unknown';

// Objective scoring via the existing scorer (no --save → prints the observation).
const out = execFileSync(process.execPath,
  [path.join(ROOT, 'scripts/bench-score.js'), TRAPS[trap].fixture, arm, path.resolve(candidate), '--model', model],
  { encoding: 'utf8' });
const base = JSON.parse(out);

const obs = {
  ...base,
  trap,
  arm,
  session: Number(session),
  compaction: Number(compaction),
  lean_compliant: classify(trap, base),
};
fs.appendFileSync(OUT, JSON.stringify(obs) + '\n');
console.log('saved:', JSON.stringify(obs));

module.exports = { classify, TRAPS };
