'use strict';
// Runnable check for the mid-session config advisory (PreToolUse + PostToolUse: Edit|Write).
// Spawns whippet-config-edit-check.js as a real subprocess in both phases so the stdin/stdout/env,
// the pre-edit baseline, and the exit-0 contract are exercised end-to-end. An "edit" is modelled
// as: write the pre-edit file state -> run `pre` -> write the post-edit state -> run `post`.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const fails = [];
const CLEANUP = [];
const ck = (name, cond) => { if (cond) pass++; else { fail++; fails.push(name); } console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cfg-')); CLEANUP.push(d); return d; }
const HOOK = path.join(__dirname, 'whippet-config-edit-check.js');

let n = 0;
const freshSid = () => `edit-test-${process.pid}-${n++}`;
const stdin = (filePath, sid) => JSON.stringify({ session_id: sid, tool_input: { file_path: filePath } });

// One broken hook = exactly one "hook script missing" error; the script path makes the detail unique.
const missing = (tag) => path.join(os.tmpdir(), `no-such-${process.pid}-${tag}.js`);
const brokenHook = (tag) => ({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${missing(tag)}"` }] }] } });

function writeState(dir, state) {
  for (const [name, content] of Object.entries(state)) {
    const p = path.join(dir, name);
    if (content === null) { try { fs.rmSync(p, { force: true }); } catch {} }
    else fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  }
}
function phase(dir, base, sid, ph, env) {
  return spawnSync('node', [HOOK, ph], { input: stdin(path.join(dir, base), sid), encoding: 'utf8', env: { ...process.env, ...env } });
}
// Model an edit to `base`: snapshot pre-state (run pre), apply post-state (run post). Return both.
function edit(dir, base, sid, preState, postState, env) {
  writeState(dir, preState);
  const pre = phase(dir, base, sid, 'pre', env);
  writeState(dir, postState);
  const post = phase(dir, base, sid, 'post', env);
  return { pre, post };
}
const silent = (r) => r.stdout.trim() === '';
const introduced = (r, str) => new RegExp(`this edit introduced ${str} new error\\(s\\) in `).test(r.stdout);

/* 1. the pre phase never speaks, even on a broken file */
{
  const dir = tmp(); writeState(dir, { 'settings.json': brokenHook('p1') });
  const r = phase(dir, 'settings.json', freshSid(), 'pre');
  ck('pre phase is silent', silent(r));
  ck('pre phase exits 0', r.status === 0);
}

/* 2. clean -> clean edit -> silent */
{
  const dir = tmp(); const { post } = edit(dir, 'settings.json', freshSid(), { 'settings.json': '{}' }, { 'settings.json': '{}' });
  ck('clean edit -> silent', silent(post));
  ck('clean edit -> exit 0', post.status === 0);
}

/* 3. clean -> broken (introduces one error) -> exactly one advisory line scoped to the file */
{
  const dir = tmp(); const { post } = edit(dir, 'settings.json', freshSid(), { 'settings.json': '{}' }, { 'settings.json': brokenHook('a') });
  ck('introduced error -> advisory (1 new, in settings.json)', introduced(post, '1') && /in settings\.json/.test(post.stdout));
  ck('advisory is one line', post.stdout.trim().split('\n').length === 1);
  ck('introduced error -> exit 0', post.status === 0);
}

/* 4. clean -> malformed JSON -> advisory */
{
  const dir = tmp(); const { post } = edit(dir, 'settings.json', freshSid(), { 'settings.json': '{}' }, { 'settings.json': '{ not valid json' });
  ck('malformed JSON -> advisory', introduced(post, '1'));
  ck('malformed JSON -> exit 0', post.status === 0);
}

/* 5. F2: a PRE-EXISTING error (present before AND after the edit) is never announced */
{
  const dir = tmp(); const broken = brokenHook('pre');
  const { post } = edit(dir, 'settings.json', freshSid(), { 'settings.json': broken }, { 'settings.json': broken });
  ck('pre-existing error not re-announced', silent(post));
  ck('pre-existing case -> exit 0', post.status === 0);
}

/* 6. F2: an error living in .mcp.json is not blamed on a settings.json edit */
{
  const dir = tmp();
  const mcp = { mcpServers: { srv: { type: 'stdio', command: 'node', args: ['./missing.js'] } } };
  const { post } = edit(dir, 'settings.json', freshSid(),
    { 'settings.json': '{}', '.mcp.json': mcp }, { 'settings.json': '{}', '.mcp.json': mcp });
  ck('error in .mcp.json -> not attributed to settings.json edit', silent(post));
}

/* 7. F4: the same error in settings.json AND settings.local.json is counted once for the file edited */
{
  const dir = tmp(); const broken = brokenHook('dup');
  const { post } = edit(dir, 'settings.json', freshSid(),
    { 'settings.json': '{}', 'settings.local.json': '{}' },
    { 'settings.json': broken, 'settings.local.json': broken });
  ck('same error in both files -> counts once for settings.json', introduced(post, '1') && !/introduced 2/.test(post.stdout));
}

/* 8. F5: fixing hook A while introducing a different broken hook B (same title) still reports B */
{
  const dir = tmp();
  const { post } = edit(dir, 'settings.json', freshSid(),
    { 'settings.json': brokenHook('A') }, { 'settings.json': brokenHook('B') });
  ck('distinct hook, same title -> reported (detail in signature)', introduced(post, '1'));
}

/* 9. F6: an error fixed and later re-introduced in the same session is announced again */
{
  const dir = tmp(); const sid = freshSid(); const broken = brokenHook('re');
  const e1 = edit(dir, 'settings.json', sid, { 'settings.json': '{}' }, { 'settings.json': broken });
  const e2 = edit(dir, 'settings.json', sid, { 'settings.json': broken }, { 'settings.json': '{}' });
  const e3 = edit(dir, 'settings.json', sid, { 'settings.json': '{}' }, { 'settings.json': broken });
  ck('F6 introduce -> advisory', introduced(e1.post, '1'));
  ck('F6 fix -> silent', silent(e2.post));
  ck('F6 re-introduce -> advisory again', introduced(e3.post, '1'));
}

/* 10. a non-config file edit is ignored, even with a broken settings.json present */
{
  const dir = tmp(); writeState(dir, { 'settings.json': brokenHook('nc') });
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hello');
  const r = phase(dir, 'notes.txt', freshSid(), 'post');
  ck('non-config edit -> silent', silent(r));
  ck('non-config edit -> exit 0', r.status === 0);
}

/* 11. off-switch silences both phases */
{
  const dir = tmp(); const { post } = edit(dir, 'settings.json', freshSid(),
    { 'settings.json': '{}' }, { 'settings.json': brokenHook('off') }, { WHIPPET_CONFIG_OFF: '1' });
  ck('WHIPPET_CONFIG_OFF -> silent', silent(post));
  ck('WHIPPET_CONFIG_OFF -> exit 0', post.status === 0);
}

/* 12. post with no pre-baseline (pre never ran) -> stay silent rather than misattribute */
{
  const dir = tmp(); writeState(dir, { 'settings.json': brokenHook('np') });
  const r = phase(dir, 'settings.json', freshSid(), 'post');
  ck('post without a baseline -> silent (graceful)', silent(r));
  ck('post without a baseline -> exit 0', r.status === 0);
}

for (const c of CLEANUP) { try { fs.rmSync(c, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.error('FAILED: ' + fails.join(', ')); process.exit(1); }
