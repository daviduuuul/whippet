#!/usr/bin/env node
// Rubric-based, reference-guided LLM judge for the qualitative metrics — the
// part no objective metric can score (over-engineering, dependency justification,
// reuse, terse-but-complete reporting). Model-agnostic: it emits the judge prompt
// and ingests the verdict, so you point any model at it (this session, or an API).
// Position bias is controlled by judging twice with the solutions swapped and
// counting a win only when it holds both ways (MT-Bench).
//
// STATUS: SCAFFOLDING — NOT YET RUN. It has produced zero observations, so whippet
// makes NO qualitative claim (METHODOLOGY guardrail 6). A real run needs a judge from
// a DIFFERENT model family than the one under test, recorded both ways; the `selftest`
// below only checks the resolver, not that any judging happened.
//
//   node scripts/judge.js prompt <fixture> <dirA> <dirB> [--swap]
//   node scripts/judge.js record <fixture> <armA> <armB> <verdict.json> <verdict-swapped.json> [--model M]
//   node scripts/judge.js selftest
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const meta = (id) => JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/fixtures', id, 'meta.json'), 'utf8'));

const walk = (base, rel = '', out = []) => {
  for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) walk(base, r, out);
    else out.push(r.replace(/\\/g, '/'));
  }
  return out;
};
const dump = (dir) => walk(dir).map((f) => `--- ${f} ---\n${fs.readFileSync(path.join(dir, f), 'utf8')}`).join('\n');

const RUBRIC = `Score each solution 1-5 on:
- right_sized: 5 = exactly the code the task needs; 1 = heavily over-engineered (needless abstraction, layers, extra files).
- dep_justified: 5 = no gratuitous dependency (used stdlib/native/existing where possible); 1 = added a library for a job already covered.
- reuse_quality: 5 = reused existing/native code where available; 1 = reinvented it.
- terse_complete: 5 = the explanation is terse yet complete; 1 = verbose or padded.
A shorter solution that fully meets the task is BETTER, not worse — do not reward length.`;

// Map a positional verdict ({winner, scores:{1,2}}) onto arm names.
function byArm(v, armA, armB, swapped) {
  const m = swapped ? { 1: armB, 2: armA } : { 1: armA, 2: armB };
  const scores = { [m[1]]: v.scores['1'], [m[2]]: v.scores['2'] };
  const winner = v.winner === 'tie' ? 'tie' : m[v.winner];
  return { scores, winner };
}

// Resolve the two orderings: a win counts only if both agree; scores are averaged.
function resolve(normal, swapped, armA, armB) {
  const n = byArm(normal, armA, armB, false);
  const s = byArm(swapped, armA, armB, true);
  const keys = ['right_sized', 'dep_justified', 'reuse_quality', 'terse_complete'];
  const avg = (a, b) => Object.fromEntries(keys.map((k) => [k, (a[k] + b[k]) / 2]));
  return {
    consistent: n.winner === s.winner,
    winner: n.winner === s.winner ? n.winner : 'tie',
    scores: { [armA]: avg(n.scores[armA], s.scores[armA]), [armB]: avg(n.scores[armB], s.scores[armB]) },
  };
}

const cmd = process.argv[2];

if (cmd === 'prompt') {
  const [id, dirA, dirB] = process.argv.slice(3);
  const swap = process.argv.includes('--swap');
  const fx = path.join(root, 'benchmarks/fixtures', id);
  const [first, second] = swap ? [dirB, dirA] : [dirA, dirB];
  process.stdout.write(
`You are judging two solutions to a coding task. Use a different model family than the one that produced them.

TASK
${fs.readFileSync(path.join(fx, meta(id).prompt), 'utf8')}

REFERENCE (a known-good lean solution, for grounding):
${dump(path.join(fx, 'reference'))}

SOLUTION 1
${dump(path.resolve(first))}

SOLUTION 2
${dump(path.resolve(second))}

${RUBRIC}

Return STRICT JSON only, no prose:
{"winner": 1 | 2 | "tie", "scores": {"1": {"right_sized":n,"dep_justified":n,"reuse_quality":n,"terse_complete":n}, "2": {"right_sized":n,"dep_justified":n,"reuse_quality":n,"terse_complete":n}}}
`);
  process.exit(0);
}

if (cmd === 'record') {
  const [id, armA, armB, vNorm, vSwap] = process.argv.slice(3);
  const mi = process.argv.indexOf('--model');
  const model = mi > -1 ? process.argv[mi + 1] : 'unknown';
  const normal = JSON.parse(fs.readFileSync(vNorm, 'utf8'));
  const swapped = JSON.parse(fs.readFileSync(vSwap, 'utf8'));
  const r = resolve(normal, swapped, armA, armB);
  if (!r.consistent) console.error(`position-bias warning: orderings disagree on the winner — recorded as a tie.`);
  const out = path.join(root, 'benchmarks/results/judge.jsonl');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (const arm of [armA, armB])
    fs.appendFileSync(out, JSON.stringify({ task: id, category: meta(id).category, arm, model, judge_winner: r.winner === arm, ...r.scores[arm] }) + '\n');
  console.log(`recorded ${armA} vs ${armB} on ${id}: winner=${r.winner} consistent=${r.consistent}`);
  process.exit(0);
}

if (cmd === 'selftest') {
  const assert = require('assert');
  const sc = (rs, dj, ru, tc) => ({ right_sized: rs, dep_justified: dj, reuse_quality: ru, terse_complete: tc });
  // Normal: solution 1 wins. Swapped: solution 2 wins (i.e. the same underlying arm). Consistent → that arm wins.
  const normal = { winner: 1, scores: { '1': sc(5, 5, 5, 5), '2': sc(2, 2, 2, 2) } };
  const swapped = { winner: 2, scores: { '1': sc(2, 2, 2, 2), '2': sc(5, 5, 5, 5) } };
  const r = resolve(normal, swapped, 'whippet', 'off');
  assert.strictEqual(r.consistent, true, 'agreeing orderings are consistent');
  assert.strictEqual(r.winner, 'whippet', 'winner maps back to the arm, not the slot');
  assert.strictEqual(r.scores.whippet.right_sized, 5, 'arm scores averaged across orderings');
  // Disagreeing orderings (slot bias) → tie.
  const flipped = { winner: 1, scores: { '1': sc(5, 5, 5, 5), '2': sc(2, 2, 2, 2) } };
  assert.strictEqual(resolve(normal, flipped, 'whippet', 'off').winner, 'tie', 'position-biased verdicts collapse to a tie');
  console.log('ok    judge resolve (position-bias control)');
  process.exit(0);
}

console.error('Usage: judge.js prompt|record|selftest  (see header)');
process.exit(1);
