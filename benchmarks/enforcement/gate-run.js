'use strict';
/*
 * Enforcement experiment — ARM GATE (deterministic, no model).
 *
 * H1: a gate blocks, advisory text only asks. Each scenario stages a change that
 * carries a problem whippet's own checks detect; we run `whippet check` and record
 * whether the bad change got THROUGH (exit 0) or was BLOCKED (exit != 0). The gate
 * arm is fully deterministic — no LLM, no variance — so its catch rate is a fact.
 *
 * Run: node benchmarks/enforcement/gate-run.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CHECK = path.join(__dirname, '..', '..', 'whippet', 'scripts', 'check.js');
const CLEANUP = [];
function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-enf-')); CLEANUP.push(d); return d; }
function sh(cmd, args, cwd) { return spawnSync(cmd, args, { cwd, encoding: 'utf8' }); }
function gitRepo() {
  const d = tmp();
  sh('git', ['init', '-q'], d); sh('git', ['config', 'user.email', 't@t'], d); sh('git', ['config', 'user.name', 't'], d);
  return d;
}
function write(dir, rel, c) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); }
function runCheck(dir, args) { return spawnSync('node', [CHECK, ...args], { cwd: dir, encoding: 'utf8' }); }

// Each scenario stages exactly one deterministic problem whippet check is meant to catch.
const SCENARIOS = [
  {
    name: 'bare // whippet: marker',
    build: (d) => { write(d, 'foo.js', '// whippet: quick hack\nconst x = 1;\n'); sh('git', ['add', 'foo.js'], d); },
    args: ['--staged', '--strict'],
  },
  {
    name: 'new unjustified dependency',
    build: (d) => {
      write(d, 'package.json', '{"name":"x","version":"1.0.0","dependencies":{}}');
      sh('git', ['add', '.'], d); sh('git', ['commit', '-qm', 'init'], d);
      write(d, 'package.json', '{"name":"x","version":"1.0.0","dependencies":{"left-pad":"^1"}}');
      sh('git', ['add', 'package.json'], d);
    },
    args: ['--staged', '--budget', '1000', '--strict'],
  },
  {
    name: 'over-budget diff',
    build: (d) => { write(d, 'big.js', Array.from({ length: 40 }, (_, i) => `const v${i} = ${i};`).join('\n') + '\n'); sh('git', ['add', 'big.js'], d); },
    args: ['--staged', '--budget', '10', '--strict'],
  },
];

const rows = [];
let blocked = 0;
for (const s of SCENARIOS) {
  const d = gitRepo();
  s.build(d);
  const r = runCheck(d, s.args);
  const isBlocked = r.status !== 0; // non-zero exit = the gate refused the change
  if (isBlocked) blocked++;
  rows.push({ scenario: s.name, exit: r.status, blocked: isBlocked });
}
for (const dir of CLEANUP) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log('# Enforcement — gate arm (`whippet check`, deterministic)\n');
console.log('| scenario | exit | blocked? |');
console.log('|---|---|---|');
for (const r of rows) console.log(`| ${r.scenario} | ${r.exit} | ${r.blocked ? '**YES**' : 'no — LEAKED'} |`);
const pct = (100 * blocked / rows.length).toFixed(0);
console.log(`\n**gate: ${blocked}/${rows.length} bad changes blocked (${pct}%), ${rows.length - blocked} leaked.**`);
process.exit(0);
