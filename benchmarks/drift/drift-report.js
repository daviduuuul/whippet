#!/usr/bin/env node
// Aggregate drift-runs.jsonl into the one number the drift test exists to find:
// post-compaction lean-compliance per arm, and the B-vs-C gap that separates
// packaging (CLAUDE.md re-injection) from any real whippet mechanism.
//
//   A = discipline pasted once, never repeated   (does persisting matter at all?)
//   B = discipline in CLAUDE.md                   (persists via memory re-injection)
//   C = whippet installed                         (persists via SessionStart hook)
//
// Prediction on record: C ≈ B ≫ A. If C beats B, that's a real mechanism win.
// Pure Node builtins. Run: node benchmarks/drift/drift-report.js [selftest]
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'drift-runs.jsonl');

// Wilson 95% interval for a binomial proportion (z=1.96). Textbook closed form;
// kept local so this reporter has no coupling to the A/B reporter.
function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / d;
  return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
}

// {arm → {k, n}} over lean_compliant; plus per-(arm,trap) counts. Pure, tested.
function aggregate(obs) {
  const arms = {}, byTrap = {};
  for (const o of obs) {
    if (typeof o.lean_compliant !== 'boolean') continue;
    (arms[o.arm] ||= { k: 0, n: 0 });
    arms[o.arm].n++; if (o.lean_compliant) arms[o.arm].k++;
    const key = `${o.arm}|${o.trap}`;
    (byTrap[key] ||= { k: 0, n: 0 });
    byTrap[key].n++; if (o.lean_compliant) byTrap[key].k++;
  }
  return { arms, byTrap };
}

if (process.argv[2] === 'selftest') {
  const assert = require('node:assert/strict');
  const t = [
    { arm: 'A', trap: 'stdlib', lean_compliant: false },
    { arm: 'A', trap: 'reuse', lean_compliant: true },
    { arm: 'B', trap: 'stdlib', lean_compliant: true },
    { arm: 'C', trap: 'stdlib', lean_compliant: true },
    { arm: 'C', trap: 'stdlib', lean_compliant: false },
    { arm: 'C', trap: 'x', lean_compliant: 'nope' }, // ignored: not boolean
  ];
  const { arms, byTrap } = aggregate(t);
  assert.deepEqual(arms.A, { k: 1, n: 2 });
  assert.deepEqual(arms.B, { k: 1, n: 1 });
  assert.deepEqual(arms.C, { k: 1, n: 2 }, 'non-boolean lean_compliant is ignored');
  assert.deepEqual(byTrap['C|stdlib'], { k: 1, n: 2 });
  const [lo, hi] = wilson(1, 1);
  assert.ok(lo >= 0 && hi <= 100 && lo < hi);
  console.log('drift-report selftest: pass');
  process.exit(0);
}

if (!fs.existsSync(FILE)) {
  console.log('No drift runs yet. Run subject sessions per benchmarks/drift/PROTOCOL.md,');
  console.log('score each post-compaction trap with score-drift.js, then re-run this.');
  process.exit(0);
}
const obs = fs.readFileSync(FILE, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const { arms, byTrap } = aggregate(obs);
const order = ['A', 'B', 'C'].filter((a) => arms[a]);
const traps = [...new Set(obs.map((o) => o.trap))].filter(Boolean);
const ARM_LABEL = { A: 'A paste-once', B: 'B CLAUDE.md', C: 'C whippet' };
const rate = ({ k, n }) => { const [lo, hi] = wilson(k, n); return `${k}/${n} (${lo.toFixed(0)}–${hi.toFixed(0)}%)`; };

console.log('# Drift test scoreboard\n');
console.log(`${obs.length} post-compaction observations · arms: ${order.join(', ')}\n`);
console.log('| Arm | Lean-compliant (Wilson 95%) |');
console.log('|---|---|');
for (const a of order) console.log(`| ${ARM_LABEL[a]} | ${rate(arms[a])} |`);

if (traps.length) {
  console.log('\n**By trap** (lean-compliant k/n)\n');
  console.log(`| Trap | ${order.map((a) => ARM_LABEL[a]).join(' | ')} |`);
  console.log(`|---|${order.map(() => '---').join('|')}|`);
  for (const tr of traps) {
    console.log(`| ${tr} | ${order.map((a) => { const c = byTrap[`${a}|${tr}`]; return c ? `${c.k}/${c.n}` : '—'; }).join(' | ')} |`);
  }
}

if (arms.B && arms.C) {
  const pB = arms.B.k / arms.B.n, pC = arms.C.k / arms.C.n;
  const gap = ((pC - pB) * 100).toFixed(0);
  console.log(`\n**B vs C (the decisive comparison):** C ${(pC * 100).toFixed(0)}% − B ${(pB * 100).toFixed(0)}% = ${gap > 0 ? '+' : ''}${gap} pts.`);
  console.log('Overlapping Wilson intervals → no mechanism advantage over a CLAUDE.md paste (whippet = packaging).');
  console.log('C clears B with separated intervals → a real persistence-mechanism win worth publishing.');
}

module.exports = { aggregate, wilson };
