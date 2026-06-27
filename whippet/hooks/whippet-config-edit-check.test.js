'use strict';
// Runnable check for the mid-session config advisory (PostToolUse: Edit|Write). Spawns
// whippet-config-edit-check.js as a real subprocess so the stdin/stdout/env + per-session
// cache contract is exercised end-to-end.
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

// Mirror the hook's per-session cache path so each scenario starts from a clean slate
// and we can clean up afterwards. Unique per run (pid) to avoid cross-run collisions.
let n = 0;
function freshSid() {
  const sid = `edit-test-${process.pid}-${n++}`;
  const f = path.join(os.tmpdir(), `whippet-config-seen-${sid.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  try { fs.rmSync(f, { force: true }); } catch {}
  CLEANUP.push(f);
  return sid;
}

const stdin = (filePath, sessionId) => JSON.stringify({ session_id: sessionId, tool_input: { file_path: filePath } });
function runHook({ input, env } = {}) {
  return spawnSync('node', [path.join(HOOKS, 'whippet-config-edit-check.js')], { input: input || '', encoding: 'utf8', env: { ...process.env, ...env } });
}
// A settings.json whose hook points at a script that doesn't exist -> exactly one error.
const brokenSettings = () => JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-such-xyz.js')}"` }] }] } });

// clean edit -> silent
{
  const cfg = tmp();
  const f = path.join(cfg, 'settings.json');
  fs.writeFileSync(f, '{}');
  const r = runHook({ input: stdin(f, freshSid()) });
  ck('edit-check: clean edit -> no output', r.stdout.trim() === '');
}

// edit that introduces a dead reference -> exactly one advisory line
{
  const cfg = tmp();
  const f = path.join(cfg, 'settings.json');
  fs.writeFileSync(f, brokenSettings());
  const r = runHook({ input: stdin(f, freshSid()) });
  ck('edit-check: dead ref -> advisory', /whippet config: this edit introduced 1 new error/.test(r.stdout));
  ck('edit-check: advisory is one line', r.stdout.trim().split('\n').length === 1);
}

// edit that introduces malformed JSON -> one advisory line
{
  const cfg = tmp();
  const f = path.join(cfg, 'settings.json');
  fs.writeFileSync(f, '{ this is not valid json');
  const r = runHook({ input: stdin(f, freshSid()) });
  ck('edit-check: malformed JSON -> advisory', /whippet config: this edit introduced 1 new error/.test(r.stdout));
}

// same error, edited again in the same session -> silent (never nags)
{
  const cfg = tmp();
  const f = path.join(cfg, 'settings.json');
  fs.writeFileSync(f, brokenSettings());
  const sid = freshSid();
  const first = runHook({ input: stdin(f, sid) });
  const second = runHook({ input: stdin(f, sid) });
  ck('edit-check: first edit -> advisory', /whippet config: this edit introduced 1 new error/.test(first.stdout));
  ck('edit-check: repeat edit, same error -> silent', second.stdout.trim() === '');
}

// edit to a non-config file -> silent (only settings*.json are audited)
{
  const cfg = tmp();
  fs.writeFileSync(path.join(cfg, 'settings.json'), brokenSettings()); // broken, but irrelevant file edited
  const other = path.join(cfg, 'notes.txt');
  fs.writeFileSync(other, 'hello');
  const r = runHook({ input: stdin(other, freshSid()) });
  ck('edit-check: non-config edit -> silent', r.stdout.trim() === '');
}

// off-switch
{
  const cfg = tmp();
  const f = path.join(cfg, 'settings.json');
  fs.writeFileSync(f, brokenSettings());
  const r = runHook({ input: stdin(f, freshSid()), env: { WHIPPET_CONFIG_OFF: '1' } });
  ck('edit-check: WHIPPET_CONFIG_OFF -> silent', r.stdout.trim() === '');
}

for (const c of CLEANUP) { try { fs.rmSync(c, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.error('FAILED: ' + fails.join(', ')); process.exit(1); }
