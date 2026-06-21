'use strict';
// Runnable check for the config advisory (SessionStart). Spawns whippet-config-check.js
// as a real subprocess so the stdin/stdout/env contract is exercised end-to-end.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const fails = [];
const CLEANUP = [];
const ck = (name, cond) => { if (cond) pass++; else { fail++; fails.push(name); } console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cfg-')); CLEANUP.push(d); return d; }
const HOOKS = __dirname;
function runHook(file, { env, input } = {}) {
  return spawnSync('node', [path.join(HOOKS, file)], { input: input || '', encoding: 'utf8', env: { ...process.env, ...env } });
}

// a broken hook in the config -> error advisory on stdout
{
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-such-xyz.js')}"` }] }] } }));
  const r = runHook('whippet-config-check.js', { env: { CLAUDE_CONFIG_DIR: cfg } });
  ck('config-check: errors -> advisory', /whippet config: 1 error/.test(r.stdout));
}

// a clean config -> silence
{
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), '{}');
  const r = runHook('whippet-config-check.js', { env: { CLAUDE_CONFIG_DIR: cfg } });
  ck('config-check: clean -> no output', r.stdout.trim() === '');
}

// off-switch
{
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-such-xyz.js')}"` }] }] } }));
  const r = runHook('whippet-config-check.js', { env: { CLAUDE_CONFIG_DIR: cfg, WHIPPET_CONFIG_OFF: '1' } });
  ck('config-check: WHIPPET_CONFIG_OFF -> silent', r.stdout.trim() === '');
}

for (const d of CLEANUP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.error('FAILED: ' + fails.join(', ')); process.exit(1); }
