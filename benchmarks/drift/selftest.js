#!/usr/bin/env node
// Drift-harness runnable check (wired into `npm test`):
//  1. discipline.txt is byte-identical to what whippet injects — so arms A/B
//     test the SAME content whippet's hook gives arm C, only the vehicle differs.
//     If whippet's payload changes, this fails → regenerate discipline.txt.
//  2. the score-drift and drift-report unit selftests pass.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');

const { buildPayload } = require('../../whippet/hooks/whippet-core.js');
const disk = fs.readFileSync(path.join(__dirname, 'discipline.txt'), 'utf8');
assert.equal(disk.trimEnd(), buildPayload('full').trimEnd(),
  'discipline.txt has drifted from buildPayload("full") — regenerate it so arms A/B match arm C.');
console.log('ok    discipline.txt matches whippet payload');

for (const s of ['score-drift.js', 'drift-report.js']) {
  execFileSync(process.execPath, [path.join(__dirname, s), 'selftest'], { stdio: 'inherit' });
}
console.log('drift selftest: pass');
