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
{ // N4 full-semver engine floor (major.minor.patch) must keep the major, not collapse to 0 -> still flagged
  const r = run({ pkg: { dependencies: { uuid: '^9' }, engines: { node: '>=20.10.0' } }, files: { 'index.js': "require('uuid')" } });
  ck('N4 uuid on Node >=20.10.0 -> native finding', hasFinding(r, 'native', 'native equivalent available: uuid'));
}
{ // C1 conservative: multi-purpose lib NOT flagged
  const r = run({ pkg: { dependencies: { lodash: '^4' } }, files: { 'index.js': "require('lodash')" } });
  ck('C1 lodash -> no native finding', count(r, 'native') === 0);
}
{ // N5 added swap: rfdc -> structuredClone (engine-gated)
  const r = run({ pkg: { dependencies: { rfdc: '^1' }, engines: { node: '>=18' } }, files: { 'index.js': "require('rfdc')" } });
  ck('N5 rfdc -> structuredClone native finding', hasFinding(r, 'native', 'native equivalent available: rfdc'));
}
{ // N6 caveat surfaced in detail: uuid -> randomUUID is v4-only
  const r = run({ pkg: { dependencies: { uuid: '^9' }, engines: { node: '>=22' } }, files: { 'index.js': "require('uuid')" } });
  ck('N6 uuid finding notes v4-only', r.findings.some(f => f.category === 'native' && f.title.includes('uuid') && /v4/i.test(f.detail)));
}
{ // N7 added swap still engine-gated: abort-controller sinceNode 16 -> silent on Node 15
  const r = run({ pkg: { dependencies: { 'abort-controller': '^3' }, engines: { node: '>=15' } }, files: { 'index.js': "require('abort-controller')" } });
  ck('N7 abort-controller on Node 15 -> no finding (gated)', count(r, 'native') === 0);
}
{ // N8 single-purpose deep-clone packages -> structuredClone (sinceNode 17)
  const r = run({ pkg: { dependencies: { 'lodash.clonedeep': '^4' }, engines: { node: '>=18' } }, files: { 'index.js': "require('lodash.clonedeep')" } });
  ck('N8 lodash.clonedeep -> structuredClone finding', hasFinding(r, 'native', 'native equivalent available: lodash.clonedeep'));
}
{ // N9 fast-copy -> structuredClone
  const r = run({ pkg: { dependencies: { 'fast-copy': '^3' }, engines: { node: '>=20' } }, files: { 'index.js': "require('fast-copy')" } });
  ck('N9 fast-copy -> structuredClone finding', hasFinding(r, 'native', 'native equivalent available: fast-copy'));
}
{ // N10 isarray -> Array.isArray (obsolete shim, always native)
  const r = run({ pkg: { dependencies: { isarray: '^2' }, engines: { node: '>=16' } }, files: { 'index.js': "require('isarray')" } });
  ck('N10 isarray -> Array.isArray finding', hasFinding(r, 'native', 'native equivalent available: isarray'));
}
{ // N11 es6-promise -> global Promise
  const r = run({ pkg: { dependencies: { 'es6-promise': '^4' }, engines: { node: '>=16' } }, files: { 'index.js': "require('es6-promise')" } });
  ck('N11 es6-promise -> Promise finding', hasFinding(r, 'native', 'native equivalent available: es6-promise'));
}
{ // N12 p-defer -> Promise.withResolvers, gated to Node 22
  const r22 = run({ pkg: { dependencies: { 'p-defer': '^4' }, engines: { node: '>=22' } }, files: { 'index.js': "require('p-defer')" } });
  const r20 = run({ pkg: { dependencies: { 'p-defer': '^4' }, engines: { node: '>=20' } }, files: { 'index.js': "require('p-defer')" } });
  ck('N12 p-defer flagged on Node 22, gated on Node 20', hasFinding(r22, 'native', 'native equivalent available: p-defer') && count(r20, 'native') === 0);
}
{ // N13 minimist -> util.parseArgs, gated to Node 20 (parseArgs stable at 20)
  const r20 = run({ pkg: { dependencies: { minimist: '^1' }, engines: { node: '>=20' } }, files: { 'index.js': "require('minimist')" } });
  const r18 = run({ pkg: { dependencies: { minimist: '^1' }, engines: { node: '>=18' } }, files: { 'index.js': "require('minimist')" } });
  ck('N13 minimist flagged on Node 20, gated on Node 18', hasFinding(r20, 'native', 'native equivalent available: minimist') && count(r18, 'native') === 0);
}
{ // N14 userland querystring package -> node:querystring / URLSearchParams
  const r = run({ pkg: { dependencies: { querystring: '^0.2' }, engines: { node: '>=16' } }, files: { 'index.js': "require('querystring')" } });
  ck('N14 querystring -> URLSearchParams finding', hasFinding(r, 'native', 'native equivalent available: querystring'));
}
{ // N15 PRECISION: node-fetch must NOT be flagged below Node 21 (global fetch experimental 18-20, stable 21)
  const r18 = run({ pkg: { dependencies: { 'node-fetch': '^3' }, engines: { node: '>=18' } }, files: { 'index.js': "require('node-fetch')" } });
  const r22 = run({ pkg: { dependencies: { 'node-fetch': '^3' }, engines: { node: '>=22' } }, files: { 'index.js': "require('node-fetch')" } });
  ck('N15 node-fetch gated below Node 21, flagged on Node 22', count(r18, 'native') === 0 && hasFinding(r22, 'native', 'native equivalent available: node-fetch'));
}
{ // N16 same precision floor for cross-fetch
  const r20 = run({ pkg: { dependencies: { 'cross-fetch': '^4' }, engines: { node: '>=20' } }, files: { 'index.js': "require('cross-fetch')" } });
  const r22 = run({ pkg: { dependencies: { 'cross-fetch': '^4' }, engines: { node: '>=22' } }, files: { 'index.js': "require('cross-fetch')" } });
  ck('N16 cross-fetch gated below Node 21, flagged on Node 22', count(r20, 'native') === 0 && hasFinding(r22, 'native', 'native equivalent available: cross-fetch'));
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
{ // U8 the only import is past the depth cap -> scan is partial -> no false 'unused'
  const deep = Array.from({ length: 13 }, (_, i) => `lvl${i}`).join('/') + '/feature.js';
  const r = run({ pkg: { dependencies: { deepdep: '^1' } }, files: { 'index.js': 'const x = 1', [deep]: "require('deepdep')" } });
  ck('U8 import past depth cap -> no false unused', count(r, 'unused') === 0);
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
{ // D3 new logger group: two loggers -> duplicate
  const r = run({ pkg: { dependencies: { winston: '^3', pino: '^9' } }, files: { 'index.js': "require('winston'); require('pino')" } });
  ck('D3 winston+pino -> logger duplicate', hasFinding(r, 'duplicate', 'multiple logger libraries'));
}
{ // D4 new member in an existing group: undici joins http client
  const r = run({ pkg: { dependencies: { undici: '^6', axios: '^1' } }, files: { 'index.js': "require('undici'); require('axios')" } });
  ck('D4 undici+axios -> http client duplicate', hasFinding(r, 'duplicate', 'multiple http client libraries'));
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
ck('parseNodeMin full semver -> major (minor/patch must not lower the floor)', parseNodeMin('>=18.12.0') === 18 && parseNodeMin('>=20.10.0') === 20 && parseNodeMin('^18.18.0 || >=20.10.0') === 18);

for (const d of CLEANUP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log(`\n${pass}/${pass + fail} scenarios passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
