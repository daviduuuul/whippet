'use strict';
// Runnable check for the autonomous hooks: the deps advisory (PostToolUse) and the
// config advisory (SessionStart). Pure-core asserts + spawned integration so the
// real stdin/stdout/env contract is exercised.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const core = require('./whippet-deps-core.js');
const { sessionStatePath, statePath } = require('./whippet-drift-core.js');

let pass = 0, fail = 0;
const fails = [];
const CLEANUP = [];
const ck = (name, cond) => { if (cond) pass++; else { fail++; fails.push(name); } console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const eq = (name, got, want) => ck(name, JSON.stringify(got) === JSON.stringify(want));
function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-auto-')); CLEANUP.push(d); return d; }
const HOOKS = __dirname;
function runHook(file, { env, input } = {}) {
  return spawnSync('node', [path.join(HOOKS, file)], { input: input || '', encoding: 'utf8', env: { ...process.env, ...env } });
}

/* ---- pure core ---- */
eq('pkgDirs picks package.json dirs', core.pkgDirs(['a/package.json', 'b/src/x.js', 'c/package.json']), ['a', 'c']);
eq('pkgDirs ignores non-pkg', core.pkgDirs(['src/index.js']), []);
eq('inlineFindings keeps native+duplicate, drops unused',
  core.inlineFindings([{ category: 'native', title: 'n' }, { category: 'unused', title: 'u' }, { category: 'duplicate', title: 'd' }]).map((f) => f.title), ['n', 'd']);
eq('freshFindings drops already-seen', core.freshFindings([{ title: 'a' }, { title: 'b' }], ['a']).map((f) => f.title), ['b']);
ck('advisory mentions count + fix', /whippet deps \(1\):.*uuid.*crypto\.randomUUID/.test(core.advisory([{ title: 'native equivalent available: uuid', fix: 'replace uuid with crypto.randomUUID()' }])));
ck('sessionStatePath honors kind', sessionStatePath({ session_id: 'abc' }, 'deps').includes('.whippet-deps-abc.json'));
ck('statePath stays backward-compatible', statePath({ session_id: 'abc' }).includes('.whippet-drift-abc.json'));

/* ---- config-check integration (SessionStart) ---- */
{ // a broken hook in the config -> advisory on stdout
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-such-xyz.js')}"` }] }] } }));
  const r = runHook('whippet-config-check.js', { env: { CLAUDE_CONFIG_DIR: cfg } });
  ck('config-check: errors -> advisory', /whippet config: 1 error/.test(r.stdout));
}
{ // a clean config -> silence
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), '{}');
  const r = runHook('whippet-config-check.js', { env: { CLAUDE_CONFIG_DIR: cfg } });
  ck('config-check: clean -> no output', r.stdout.trim() === '');
}
{ // off-switch
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-such-xyz.js')}"` }] }] } }));
  const r = runHook('whippet-config-check.js', { env: { CLAUDE_CONFIG_DIR: cfg, WHIPPET_CONFIG_OFF: '1' } });
  ck('config-check: WHIPPET_CONFIG_OFF -> silent', r.stdout.trim() === '');
}

/* ---- deps-check integration (PostToolUse) ---- */
{ // editing a package.json with a native-equivalent dep -> advisory, then deduped
  const proj = tmp();
  fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({ dependencies: { uuid: '^9' }, engines: { node: '>=22' } }));
  fs.writeFileSync(path.join(proj, 'index.js'), "const { v4 } = require('uuid')");
  const input = JSON.stringify({ session_id: 's1', tool_input: { file_path: path.join(proj, 'package.json') } });
  const state = tmp(); // isolate the dedup state file (sessionStatePath falls back to CLAUDE_CONFIG_DIR)
  const env = { CLAUDE_CONFIG_DIR: state };
  const r1 = runHook('whippet-posttooluse.js', { env, input });
  ck('deps-check: native dep -> advisory with uuid', /whippet deps/.test(r1.stdout) && /uuid/.test(r1.stdout));
  const r2 = runHook('whippet-posttooluse.js', { env, input });
  ck('deps-check: deduped on second edit -> silent', r2.stdout.trim() === '');
}
{ // editing a non-package.json file -> nothing
  const proj = tmp();
  const input = JSON.stringify({ session_id: 's2', tool_input: { file_path: path.join(proj, 'src.js') } });
  const r = runHook('whippet-posttooluse.js', { env: { CLAUDE_CONFIG_DIR: tmp() }, input });
  ck('deps-check: non-package.json edit -> no output', r.stdout.trim() === '');
}

for (const d of CLEANUP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log(`\n${pass}/${pass + fail} autonomy checks passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
