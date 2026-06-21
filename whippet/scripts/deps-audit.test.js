'use strict';
/*
 * Scenario suite for deps-audit: each builds an isolated temp project, runs the
 * audit, asserts findings. Conservative-by-design is the thing under test — the
 * "no false positive" scenarios matter as much as the positives.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { audit, usesPkg, parseNodeMin } = require('./deps-audit');

let pass = 0, fail = 0;
const fails = [];
const CLEANUP = [];
function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-deps-')); CLEANUP.push(d); return d; }
function build({ pkg, files }) {
  const dir = tmp();
  if (pkg !== undefined) {
    fs.writeFileSync(path.join(dir, 'package.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg, null, 2));
  }
  for (const [rel, content] of Object.entries(files || {})) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return dir;
}
function run(opts) { return audit(build(opts)); }
function ck(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); }
const hasFinding = (r, cat, frag) => r.findings.some(f => f.category === cat && f.title.includes(frag));
const count = (r, cat) => r.findings.filter(f => f.category === cat).length;

/* ---------------- native equivalents ---------------- */
{ // N1 native flagged (declaration-based: flagged even when used)
  const r = run({ pkg: { dependencies: { uuid: '^9' }, engines: { node: '>=22' } }, files: { 'index.js': "const { v4 } = require('uuid')" } });
  ck('N1 uuid -> native finding', hasFinding(r, 'native', 'native equivalent available: uuid'));
}
{ // N2 engine floor predates the native API -> suppressed
  const r = run({ pkg: { dependencies: { dotenv: '^16' }, engines: { node: '>=16' } }, files: { 'index.js': "require('dotenv')" } });
  ck('N2 dotenv on Node 16 -> no native finding', count(r, 'native') === 0);
}
{ // N3 unknown engine -> flagged with a verify note
  const r = run({ pkg: { dependencies: { 'node-fetch': '^3' } }, files: { 'index.js': "require('node-fetch')" } });
  ck('N3 node-fetch unknown engine -> native finding', hasFinding(r, 'native', 'native equivalent available: node-fetch'));
}
{ // C1 conservative: multi-purpose lib NOT flagged
  const r = run({ pkg: { dependencies: { lodash: '^4' } }, files: { 'index.js': "require('lodash')" } });
  ck('C1 lodash -> no native finding', count(r, 'native') === 0);
}

/* ---------------- unused ---------------- */
{ // U1 declared but never imported -> info
  const r = run({ pkg: { dependencies: { chalk: '^5' } }, files: { 'index.js': "console.log('hi')" } });
  ck('U1 chalk unused -> info', hasFinding(r, 'unused', 'possibly unused dependency: chalk'));
}
{ // U2 used -> not flagged
  const r = run({ pkg: { dependencies: { chalk: '^5' } }, files: { 'index.js': "const c = require('chalk')" } });
  ck('U2 chalk used -> no unused', count(r, 'unused') === 0);
}
{ // U3 subpath import counts as use
  const r = run({ pkg: { dependencies: { lodash: '^4' } }, files: { 'index.js': "const m = require('lodash/merge')" } });
  ck('U3 subpath import -> no unused', count(r, 'unused') === 0);
}
{ // U4 named in a (non-source) config file -> not flagged
  const r = run({ pkg: { dependencies: { 'prettier-plugin-tailwindcss': '^0.5' } }, files: { 'index.js': 'const x = 1', '.prettierrc.json': '{"plugins":["prettier-plugin-tailwindcss"]}' } });
  ck('U4 config-file reference -> no unused', count(r, 'unused') === 0);
}
{ // U5 used in package.json scripts -> not flagged
  const r = run({ pkg: { dependencies: { rimraf: '^5' }, scripts: { clean: 'rimraf dist' }, engines: { node: '>=16' } }, files: { 'index.js': 'const x = 1' } });
  ck('U5 scripts reference -> no unused', count(r, 'unused') === 0);
}
{ // U6 @types/* never flagged unused
  const r = run({ pkg: { dependencies: { lodash: '^4', '@types/lodash': '^4' } }, files: { 'index.js': "require('lodash')" } });
  ck('U6 @types skipped -> no unused', count(r, 'unused') === 0);
}
{ // U7 zero source files -> unused check stays silent
  const r = run({ pkg: { dependencies: { chalk: '^5' } }, files: {} });
  ck('U7 no sources -> no unused', count(r, 'unused') === 0);
}

/* ---------------- duplicate-purpose ---------------- */
{ // D1 two date libraries -> info
  const r = run({ pkg: { dependencies: { moment: '^2', dayjs: '^1' } }, files: { 'index.js': "require('moment'); require('dayjs')" } });
  ck('D1 moment+dayjs -> duplicate', hasFinding(r, 'duplicate', 'multiple date libraries'));
}
{ // D2 single member -> no duplicate
  const r = run({ pkg: { dependencies: { dayjs: '^1' } }, files: { 'index.js': "require('dayjs')" } });
  ck('D2 single date lib -> no duplicate', count(r, 'duplicate') === 0);
}

/* ---------------- robustness ---------------- */
{ // P1 no package.json -> one info, no error, clean exit
  const r = run({ files: {} });
  ck('P1 no package.json -> info only', hasFinding(r, 'deps', 'no package.json') && r.summary.error === 0 && r.findings.length === 1);
}
{ // P2 malformed package.json -> error, no crash
  let threw = false, r; try { r = run({ pkg: '{ broken' }); } catch { threw = true; }
  ck('P2 malformed package.json -> error, no crash', !threw && hasFinding(r, 'deps', 'package.json invalid JSON'));
}
{ // W1 workspaces -> info note, root audited
  const r = run({ pkg: { workspaces: ['packages/*'], dependencies: {} }, files: { 'index.js': 'const x = 1' } });
  ck('W1 workspaces -> info note', hasFinding(r, 'deps', 'workspaces detected'));
}

/* ---------------- units ---------------- */
ck('usesPkg require', usesPkg("const x = require('x')", 'x') === true);
ck('usesPkg from', usesPkg("import y from 'x'", 'x') === true);
ck('usesPkg subpath', usesPkg("require('x/sub')", 'x') === true);
ck('usesPkg string mention is NOT a use', usesPkg("const s = 'x is great'", 'x') === false);
ck('parseNodeMin >=22', parseNodeMin('>=22') === 22);
ck('parseNodeMin ^20', parseNodeMin('^20') === 20);
ck('parseNodeMin range takes floor', parseNodeMin('18 || 20') === 18 && parseNodeMin('>=18 <21') === 18);
ck('parseNodeMin unknown -> null', parseNodeMin(undefined) === null && parseNodeMin('x') === null);

for (const d of CLEANUP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log(`\n${pass}/${pass + fail} scenarios passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
