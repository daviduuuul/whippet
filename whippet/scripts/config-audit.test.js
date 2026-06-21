'use strict';
/*
 * Scenario suite: each scenario builds an isolated, freshly-polluted .claude
 * that exercises ONE behaviour, runs the audit, and asserts the findings.
 * Covers positives, negatives, edge cases and malformed input per check.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { audit, extractScriptPath } = require('./config-audit');

let pass = 0, fail = 0;
const fails = [];

const CLEANUP = [];
function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cfg-')); CLEANUP.push(d); return d; }
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}
function ck(name, cond) {
  if (cond) { pass++; } else { fail++; fails.push(name); }
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}
// build a .claude under a fresh temp dir; settings/installed are written if given
function build({ settings, installed, extra }) {
  const root = tmp();
  const cfg = path.join(root, '.claude');
  fs.mkdirSync(cfg, { recursive: true });
  if (settings !== undefined) writeJSON(path.join(cfg, 'settings.json'), settings);
  if (installed !== undefined) writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), installed);
  if (extra) extra(cfg, root);
  return { cfg, root };
}
function run(opts) { return audit(build(opts).cfg); }
const titles = r => r.findings.map(f => `${f.category}:${f.title}`);
const hasFinding = (r, cat, frag) => r.findings.some(f => f.category === cat && f.title.includes(frag));
const count = (r, cat) => r.findings.filter(f => f.category === cat).length;

// helpers to fabricate real / missing paths
function withReal(cfg, rel) { const p = path.join(cfg, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x'); return p; }

/* ---------------- A. plugins: enabled vs installed ---------------- */
{ // A1 enabled + installed + path present -> clean
  const root = tmp(); const cfg = path.join(root, '.claude');
  const ip = path.join(cfg, 'plugins', 'cache', 'p', '1'); fs.mkdirSync(ip, { recursive: true });
  writeJSON(path.join(ip, '.claude-plugin', 'plugin.json'), { name: 'p' });
  writeJSON(path.join(cfg, 'settings.json'), { enabledPlugins: { 'p@m': true } });
  writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), { plugins: { 'p@m': [{ installPath: ip }] } });
  const r = audit(cfg);
  ck('A1 enabled+installed+pathOK -> no plugin finding', count(r, 'plugins') === 0);
}
{ // A2 enabled + not installed -> error
  const r = run({ settings: { enabledPlugins: { 'ghost@m': true } }, installed: { plugins: {} } });
  ck('A2 enabled, not installed -> error', hasFinding(r, 'plugins', 'enabled but not installed: ghost@m'));
}
{ // A3 enabled + installed + cache path missing -> error
  const r = run({
    settings: { enabledPlugins: { 'p@m': true } },
    installed: { plugins: { 'p@m': [{ installPath: path.join(os.tmpdir(), 'definitely-not-here-xyz') }] } },
  });
  ck('A3 enabled, cache path missing -> error', hasFinding(r, 'plugins', 'cache path missing: p@m'));
}
{ // A4 enabled + installed array empty -> error
  const r = run({ settings: { enabledPlugins: { 'p@m': true } }, installed: { plugins: { 'p@m': [] } } });
  ck('A4 enabled, empty install entry -> error', hasFinding(r, 'plugins', 'enabled but not installed: p@m'));
}
{ // A5 installed + not enabled -> info
  const root = tmp(); const cfg = path.join(root, '.claude');
  const ip = path.join(cfg, 'plugins', 'cache', 'p', '1'); fs.mkdirSync(ip, { recursive: true });
  writeJSON(path.join(ip, '.claude-plugin', 'plugin.json'), { name: 'p' });
  writeJSON(path.join(cfg, 'settings.json'), { enabledPlugins: {} });
  writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), { plugins: { 'orphan@m': [{ installPath: ip }] } });
  const r = audit(cfg);
  ck('A5 installed, not enabled -> info', hasFinding(r, 'plugins', 'installed but not enabled: orphan@m'));
}
{ // A6 enabled:false + installed -> info, NOT error
  const root = tmp(); const cfg = path.join(root, '.claude');
  const ip = path.join(cfg, 'plugins', 'cache', 'p', '1'); fs.mkdirSync(ip, { recursive: true });
  writeJSON(path.join(ip, '.claude-plugin', 'plugin.json'), { name: 'p' });
  writeJSON(path.join(cfg, 'settings.json'), { enabledPlugins: { 'p@m': false } });
  writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), { plugins: { 'p@m': [{ installPath: ip }] } });
  const r = audit(cfg);
  ck('A6 enabled:false -> info not error', hasFinding(r, 'plugins', 'installed but not enabled: p@m') && r.summary.error === 0);
}

/* ---------------- B. marketplaces ---------------- */
{ // B1 directory + path exists -> warning
  const root = tmp(); const cfg = path.join(root, '.claude');
  const dir = path.join(root, 'mk'); fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(cfg, 'settings.json'), { extraKnownMarketplaces: { local: { source: { source: 'directory', path: dir } } } });
  const r = audit(cfg);
  ck('B1 directory mk, path exists -> warning', hasFinding(r, 'marketplace', 'fragile local marketplace: local'));
}
{ // B2 directory + path missing -> error
  const r = run({ settings: { extraKnownMarketplaces: { dead: { source: { source: 'directory', path: path.join(os.tmpdir(), 'no-mk-xyz') } } } } });
  ck('B2 directory mk, path missing -> error', hasFinding(r, 'marketplace', 'local marketplace path missing: dead'));
}
{ // B3 directory + no path -> error
  const r = run({ settings: { extraKnownMarketplaces: { dead: { source: { source: 'directory' } } } } });
  ck('B3 directory mk, no path -> error', hasFinding(r, 'marketplace', 'local marketplace path missing: dead'));
}
{ // B4 github source -> no finding
  const r = run({ settings: { extraKnownMarketplaces: { gh: { source: { source: 'github', repo: 'a/b' } } } } });
  ck('B4 github mk -> no finding', count(r, 'marketplace') === 0);
}
{ // B5 no marketplaces -> no finding
  const r = run({ settings: {} });
  ck('B5 no mk -> no finding', count(r, 'marketplace') === 0);
}

/* ---------------- C. hooks ---------------- */
{ // C1 hook file exists -> clean
  const root = tmp(); const cfg = path.join(root, '.claude');
  const hk = withReal(cfg, path.join('hooks', 'h.js'));
  writeJSON(path.join(cfg, 'settings.json'), { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${hk}"` }] }] } });
  const r = audit(cfg);
  ck('C1 hook file exists -> no finding', count(r, 'hooks') === 0);
}
{ // C2 hook file missing -> error
  const r = run({ settings: { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-hook-xyz.js')}"` }] }] } } });
  ck('C2 hook file missing -> error', hasFinding(r, 'hooks', 'hook script missing: PreToolUse'));
}
{ // C3 inline command (no script file) -> no finding
  const r = run({ settings: { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } } });
  ck('C3 inline command -> no finding', count(r, 'hooks') === 0);
}
{ // C4 path with trailing arg -> detects missing
  const r = run({ settings: { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `node.exe "${path.join(os.tmpdir(), 'gone-xyz.mjs')}" dev` }] }] } } });
  ck('C4 path + trailing arg -> error', hasFinding(r, 'hooks', 'hook script missing: SessionStart'));
}
{ // C5 multiple events mixed -> 2 errors
  const r = run({ settings: { hooks: {
    PreToolUse: [{ hooks: [{ type: 'command', command: `pwsh -File "${path.join(os.tmpdir(), 'a-xyz.ps1')}"` }] }],
    PostToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'b-xyz.js')}"` }] }],
  } } });
  ck('C5 two broken hooks across events -> 2 errors', count(r, 'hooks') === 2);
}
{ // C6 malformed hooks (groups not array, empty group, null hooks) -> no crash, no finding
  let threw = false, r;
  try { r = run({ settings: { hooks: { PreToolUse: { not: 'an array' }, Stop: [{}], PostToolUse: [{ hooks: null }] } } }); }
  catch { threw = true; }
  ck('C6 malformed hooks -> no crash / no finding', !threw && count(r, 'hooks') === 0);
}

/* ---------------- R. robustness: valid-JSON-but-wrong-shape (must not crash) ---------------- */
{ // settings.json = null
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, 'settings.json'), 'null');
  let threw = false, r; try { r = audit(cfg); } catch { threw = true; }
  ck('R1 settings.json null -> finding, no crash', !threw && hasFinding(r, 'config', 'settings.json is not a JSON object'));
}
{ // settings.json = array
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, 'settings.json'), '[1,2]');
  let threw = false, r; try { r = audit(cfg); } catch { threw = true; }
  ck('R2 settings.json array -> finding, no crash', !threw && hasFinding(r, 'config', 'settings.json is not a JSON object'));
}
{ // enabledPlugins: true (Object.values would throw)
  let threw = false, r; try { r = run({ settings: { enabledPlugins: true } }); } catch { threw = true; }
  ck('R3 enabledPlugins:true -> finding, no crash', !threw && hasFinding(r, 'config', 'enabledPlugins is not an object'));
}
{ // hooks: true (Object.entries would throw)
  let threw = false; try { run({ settings: { hooks: true } }); } catch { threw = true; }
  ck('R4 hooks:true -> no crash', !threw);
}
{ // permissions: true
  let threw = false; try { run({ settings: { permissions: true } }); } catch { threw = true; }
  ck('R5 permissions:true -> no crash', !threw);
}
{ // installPath: null must be flagged, not silently skipped
  const r = run({ settings: { enabledPlugins: { 'p@m': true } }, installed: { plugins: { 'p@m': [{ installPath: null }] } } });
  ck('R6 installPath null -> cache path missing', hasFinding(r, 'plugins', 'cache path missing: p@m'));
}

/* ---------------- H. hook validity (event / matcher / command) ---------------- */
{ // H1 unknown event name -> error
  const r = run({ settings: { hooks: { BadEvent: [{ hooks: [{ type: 'command', command: 'echo x' }] }] } } });
  ck('H1 unknown hook event -> error', hasFinding(r, 'hooks', 'unknown hook event: BadEvent'));
}
{ // H2 invalid matcher regex -> error
  const r = run({ settings: { hooks: { PreToolUse: [{ matcher: '[invalid(regex', hooks: [{ type: 'command', command: 'echo x' }] }] } } });
  ck('H2 invalid matcher regex -> error', hasFinding(r, 'hooks', 'invalid hook matcher: PreToolUse'));
}
{ // H3 command-type hook with no command -> error
  const r = run({ settings: { hooks: { Stop: [{ hooks: [{ type: 'command' }] }] } } });
  ck('H3 missing command -> error', hasFinding(r, 'hooks', 'hook missing command: Stop'));
}
{ // H4 valid event + valid matcher + real script -> clean
  const root = tmp(); const cfg = path.join(root, '.claude');
  const hk = withReal(cfg, path.join('hooks', 'h.js'));
  writeJSON(path.join(cfg, 'settings.json'), { hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: `node "${hk}"` }] }] } });
  ck('H4 valid hook -> clean', count(audit(cfg), 'hooks') === 0);
}

/* ---------------- I. MCP servers ---------------- */
const mcpFix = (obj, file = '.mcp.json') => ({ settings: {}, extra: (cfg) => writeJSON(path.join(cfg, file), obj) });
{ // I1 stdio with command -> clean
  ck('I1 stdio + command -> clean', count(run(mcpFix({ mcpServers: { good: { type: 'stdio', command: 'npx foo' } } })), 'mcp') === 0);
}
{ // I2 stdio missing command -> error
  ck('I2 stdio, no command -> error', hasFinding(run(mcpFix({ mcpServers: { bad: { type: 'stdio' } } })), 'mcp', 'MCP server missing command: bad'));
}
{ // I3 http missing url -> error
  ck('I3 http, no url -> error', hasFinding(run(mcpFix({ mcpServers: { web: { type: 'http' } } })), 'mcp', 'MCP server missing url: web'));
}
{ // I4 invalid transport -> warning
  ck('I4 bad transport -> warning', hasFinding(run(mcpFix({ mcpServers: { x: { type: 'htttp', url: 'http://a' } } })), 'mcp', 'invalid MCP transport: x'));
}
{ // I5 read from .claude.json too
  ck('I5 mcp in .claude.json -> error', hasFinding(run(mcpFix({ mcpServers: { c: { type: 'stdio' } } }, '.claude.json')), 'mcp', 'MCP server missing command: c'));
}
{ // I6 no mcp files -> no finding
  ck('I6 no mcp -> no finding', count(run({ settings: {} }), 'mcp') === 0);
}

/* ---------------- J. extended JSON validity ---------------- */
{ // J1 malformed .mcp.json -> config error
  ck('J1 malformed .mcp.json -> error', hasFinding(run(mcpFix('{ broken', '.mcp.json')), 'config', '.mcp.json invalid JSON'));
}
{ // J2 malformed .claude.json -> config error
  ck('J2 malformed .claude.json -> error', hasFinding(run(mcpFix('{ broken', '.claude.json')), 'config', '.claude.json invalid JSON'));
}
{ // J3 malformed settings.local.json -> config error
  const r = run({ settings: {}, extra: (cfg) => writeJSON(path.join(cfg, 'settings.local.json'), '{ broken') });
  ck('J3 malformed settings.local.json -> error', hasFinding(r, 'config', 'settings.local.json invalid JSON'));
}

/* ---------------- D. statusLine ---------------- */
{ // D1 exists -> clean
  const root = tmp(); const cfg = path.join(root, '.claude');
  const sl = withReal(cfg, 'status.js');
  writeJSON(path.join(cfg, 'settings.json'), { statusLine: { command: `node "${sl}"` } });
  const r = audit(cfg);
  ck('D1 statusLine exists -> no finding', count(r, 'statusline') === 0);
}
{ // D2 missing -> error
  const r = run({ settings: { statusLine: { command: `node "${path.join(os.tmpdir(), 'no-sl-xyz.js')}"` } } });
  ck('D2 statusLine missing -> error', hasFinding(r, 'statusline', 'statusLine script missing'));
}
{ // D3 none -> no finding
  ck('D3 no statusLine -> no finding', count(run({ settings: {} }), 'statusline') === 0);
}
{ // D4 inline (no file) -> no finding
  const r = run({ settings: { statusLine: { command: 'echo hi' } } });
  ck('D4 statusLine inline -> no finding', count(r, 'statusline') === 0);
}

/* ---------------- E. stale backups ---------------- */
{ // E1 backups with entries -> info each
  const r = run({ settings: {}, extra: (cfg) => {
    fs.mkdirSync(path.join(cfg, 'backups', 'one.removed'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'backups', 'two.bak'), { recursive: true });
  } });
  ck('E1 backups -> info per entry', count(r, 'stale') === 2);
}
{ // E2 no backups dir -> no finding
  ck('E2 no backups dir -> no finding', count(run({ settings: {} }), 'stale') === 0);
}
{ // E3 empty backups dir -> no finding
  const r = run({ settings: {}, extra: (cfg) => fs.mkdirSync(path.join(cfg, 'backups'), { recursive: true }) });
  ck('E3 empty backups dir -> no finding', count(r, 'stale') === 0);
}

/* ---------------- F. robustness ---------------- */
{ // F1 settings.json missing -> config error
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  const r = audit(cfg);
  ck('F1 settings missing -> config error', hasFinding(r, 'config', 'settings.json missing'));
}
{ // F2 settings.json malformed -> config error
  const r = run({ settings: '{ not valid json' });
  ck('F2 settings malformed -> config error', hasFinding(r, 'config', 'settings.json invalid JSON'));
}
{ // F3 installed_plugins.json missing but plugins enabled -> ONE error, not N
  const r = run({ settings: { enabledPlugins: { 'a@m': true, 'b@m': true } } }); // no installed file
  ck('F3 inventory missing -> single error, no spam',
    hasFinding(r, 'plugins', 'installed_plugins.json missing') && count(r, 'plugins') === 1);
}
{ // F4 empty-ish config -> clean
  const r = run({ settings: {} });
  ck('F4 empty config -> clean', r.findings.length === 0);
}

/* ---------------- G. extractScriptPath unit ---------------- */
ck('G1 quoted .ps1', extractScriptPath('pwsh -File "C:\\a\\b.ps1"') === 'C:\\a\\b.ps1');
ck('G2 node x.mjs dev', extractScriptPath('node.exe /x/y.mjs dev') === '/x/y.mjs');
ck('G3 no script -> null', extractScriptPath('echo hello world') === null);
ck('G4 non-string -> null', extractScriptPath(undefined) === null);
ck('G5 glob arg is not a script -> null', extractScriptPath('prettier --write src/**/*.js') === null && extractScriptPath('eslint "src/**/*.js" --fix') === null);
{ // G6 end-to-end: a hook running a formatter over a glob is valid, not a missing script
  const r = run({ settings: { hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'prettier --write src/**/*.js' }] }] } } });
  ck('G6 hook glob arg -> no false missing-script', count(r, 'hooks') === 0);
}

/* ---------------- K. duplicate local component vs plugin (#13) ---------------- */
// fabricate an installed plugin under cfg; returns its installPath
function fakePlugin(cfg, key, { manifest, components } = {}) {
  const ip = path.join(cfg, 'plugins', 'cache', 'fake', key, '1');
  fs.mkdirSync(ip, { recursive: true });
  if (manifest !== null) writeJSON(path.join(ip, '.claude-plugin', 'plugin.json'), manifest === undefined ? { name: key } : manifest);
  for (const n of (components && components.skills) || []) { const d = path.join(ip, 'skills', n); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'SKILL.md'), 'x'); }
  for (const n of (components && components.commands) || []) { fs.mkdirSync(path.join(ip, 'commands'), { recursive: true }); fs.writeFileSync(path.join(ip, 'commands', n + '.md'), 'x'); }
  return ip;
}
function withPlugin(opts) {
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  writeJSON(path.join(cfg, 'settings.json'), {});
  const ip = fakePlugin(cfg, opts.key || 'p@m', opts.plugin || {});
  writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), { plugins: { [opts.key || 'p@m']: [{ installPath: ip }] } });
  if (opts.local) opts.local(cfg);
  return cfg;
}
function localSkill(cfg, name) { const d = path.join(cfg, 'skills', name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'SKILL.md'), 'x'); }
function localCommand(cfg, name) { fs.mkdirSync(path.join(cfg, 'commands'), { recursive: true }); fs.writeFileSync(path.join(cfg, 'commands', name + '.md'), 'x'); }

{ // K1 local skill collides with plugin skill -> warning
  const r = audit(withPlugin({ plugin: { components: { skills: ['foo'] } }, local: (c) => localSkill(c, 'foo') }));
  ck('K1 local skill shadows plugin -> warning', hasFinding(r, 'duplicate', 'local skill shadows plugin: foo'));
}
{ // K2 local command collides with plugin command -> warning
  const r = audit(withPlugin({ plugin: { components: { commands: ['bar'] } }, local: (c) => localCommand(c, 'bar') }));
  ck('K2 local command shadows plugin -> warning', hasFinding(r, 'duplicate', 'local command shadows plugin: bar'));
}
{ // K3 local skill unique to user -> no duplicate
  const r = audit(withPlugin({ plugin: { components: { skills: ['foo'] } }, local: (c) => localSkill(c, 'unique') }));
  ck('K3 unique local skill -> no duplicate', count(r, 'duplicate') === 0);
}
{ // K4 no local components -> no duplicate
  const r = audit(withPlugin({ plugin: { components: { skills: ['foo'] } } }));
  ck('K4 no local components -> no duplicate', count(r, 'duplicate') === 0);
}

/* ---------------- L. plugin manifest references (#11) ---------------- */
{ // L1 install path with no plugin.json -> no finding (lean plugins legitimately ship none)
  const r = audit(withPlugin({ plugin: { manifest: null } }));
  ck('L1 no manifest -> no finding', count(r, 'manifest') === 0);
}
{ // L2 malformed plugin.json -> manifest invalid
  const r = audit(withPlugin({ plugin: { manifest: '{ broken' } }));
  ck('L2 manifest malformed -> error', hasFinding(r, 'manifest', 'plugin manifest invalid'));
}
{ // L3 manifest references a missing path -> error
  const r = audit(withPlugin({ plugin: { manifest: { name: 'p', hooks: './hooks/hooks.json' } } }));
  ck('L3 manifest path missing -> error', hasFinding(r, 'manifest', 'manifest path missing'));
}
{ // L4 manifest references an existing path -> clean
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  writeJSON(path.join(cfg, 'settings.json'), {});
  const ip = fakePlugin(cfg, 'p@m', { manifest: { name: 'p', commands: ['./commands/x.md'] } });
  fs.mkdirSync(path.join(ip, 'commands'), { recursive: true }); fs.writeFileSync(path.join(ip, 'commands', 'x.md'), 'x');
  writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), { plugins: { 'p@m': [{ installPath: ip }] } });
  ck('L4 manifest path present -> clean', count(audit(cfg), 'manifest') === 0);
}
{ // L5 valid manifest, no path fields -> clean
  const r = audit(withPlugin({ plugin: {} }));
  ck('L5 plain manifest -> clean', count(r, 'manifest') === 0);
}

/* ---------------- M. malformed permission rules (#4) ---------------- */
{ // M1 valid rules -> clean
  const r = run({ settings: { permissions: { allow: ['Bash(npm run *)', 'WebFetch', 'mcp__memory__read_graph'], deny: ['Read(~/.ssh/**)'] } } });
  ck('M1 valid permission rules -> clean', count(r, 'permissions') === 0);
}
{ ck('M2 "Bash npm" -> warning', hasFinding(run({ settings: { permissions: { allow: ['Bash npm'] } } }), 'permissions', 'malformed permission rule: allow')); }
{ ck('M3 unclosed paren -> warning', hasFinding(run({ settings: { permissions: { deny: ['Bash('] } } }), 'permissions', 'malformed permission rule: deny')); }
{ ck('M4 non-string rule -> warning', hasFinding(run({ settings: { permissions: { ask: [123] } } }), 'permissions', 'malformed permission rule: ask')); }
{ ck('M5 no permissions -> clean', count(run({ settings: {} }), 'permissions') === 0); }

/* ---------------- N. component frontmatter (#18) ---------------- */
function writeComp(cfg, type, name, frontmatter) {
  const body = frontmatter === null ? '# no frontmatter\nbody\n' : `---\n${frontmatter}\n---\nbody\n`;
  if (type === 'skills') { const d = path.join(cfg, 'skills', name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'SKILL.md'), body); }
  else { fs.mkdirSync(path.join(cfg, type), { recursive: true }); fs.writeFileSync(path.join(cfg, type, name + '.md'), body); }
}
function withCfg(builder) {
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  writeJSON(path.join(cfg, 'settings.json'), {});
  builder(cfg);
  return cfg;
}
ck('N1 skill name+description -> clean', count(audit(withCfg(c => writeComp(c, 'skills', 'foo', 'name: foo\ndescription: does foo'))), 'frontmatter') === 0);
ck('N2 skill missing description -> warning', hasFinding(audit(withCfg(c => writeComp(c, 'skills', 'foo', 'name: foo'))), 'frontmatter', 'skill frontmatter missing description: foo'));
ck('N3 skill no frontmatter -> warning', hasFinding(audit(withCfg(c => writeComp(c, 'skills', 'foo', null))), 'frontmatter', 'skill has no frontmatter: foo'));
ck('N4 agent missing name -> warning', hasFinding(audit(withCfg(c => writeComp(c, 'agents', 'bar', 'description: an agent'))), 'frontmatter', 'agent frontmatter missing name: bar'));
ck('N5 command no frontmatter -> clean', count(audit(withCfg(c => writeComp(c, 'commands', 'baz', null))), 'frontmatter') === 0);
ck('N6 command missing description -> warning', hasFinding(audit(withCfg(c => writeComp(c, 'commands', 'baz', 'argument-hint: x'))), 'frontmatter', 'command frontmatter missing description: baz'));

/* ---------------- regression: review fixes ---------------- */
// #3 runtime-resolved hook path must NOT be flagged missing
ck('C7 ${CLAUDE_PLUGIN_ROOT} hook -> no finding',
  count(run({ settings: { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/hooks/x.js' }] }] } } }), 'hooks') === 0);
// #1 dotted / glob / mcp permission rules are valid
ck('M6 dotted/glob/mcp rules -> clean',
  count(run({ settings: { permissions: { allow: ['vendor.tool', 'Bash(*.sh)', 'mcp__a__b'] } } }), 'permissions') === 0);
// mcp server-wildcard rules are documented & valid (mcp__server__*, mcp__server__get_*)
ck('M7 mcp server-wildcard rules -> clean',
  count(run({ settings: { permissions: { allow: ['mcp__memory__*', 'mcp__github__get_*'] } } }), 'permissions') === 0);
// but a bare unanchored mcp__* (which Claude Code itself rejects) stays flagged
ck('M8 bare mcp__* still flagged',
  hasFinding(run({ settings: { permissions: { allow: ['mcp__*'] } } }), 'permissions', 'malformed permission rule: allow'));
// #2 flat-shape marketplace must still be checked
ck('B6 flat marketplace path missing -> error',
  hasFinding(run({ settings: { extraKnownMarketplaces: { flat: { source: 'directory', path: path.join(os.tmpdir(), 'no-flat-mk-xyz') } } } }), 'marketplace', 'local marketplace path missing: flat'));
// #8 a UTF-8 BOM on a valid JSON file must not read as invalid
{
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, 'settings.json'), '﻿' + JSON.stringify({ enabledPlugins: {} }));
  ck('F5 BOM settings -> not invalid JSON', !hasFinding(audit(cfg), 'config', 'invalid JSON'));
}

/* ---------------- maturity: enums, hook/statusLine type, CRLF frontmatter ---------------- */
ck('enum permissions.defaultMode invalid -> warning',
  hasFinding(run({ settings: { permissions: { defaultMode: 'manual' } } }), 'settings', 'invalid permissions.defaultMode: manual'));
ck('enum permissions.defaultMode valid -> clean',
  count(run({ settings: { permissions: { defaultMode: 'acceptEdits' } } }), 'settings') === 0);
ck('enum autoUpdatesChannel invalid -> warning',
  hasFinding(run({ settings: { autoUpdatesChannel: 'nightly' } }), 'settings', 'invalid autoUpdatesChannel: nightly'));
ck('statusLine type non-command -> warning',
  hasFinding(run({ settings: { statusLine: { type: 'static', command: 'x' } } }), 'statusline', "statusLine type not 'command'"));
ck('unknown hook type -> warning',
  hasFinding(run({ settings: { hooks: { Stop: [{ hooks: [{ type: 'webhook' }] }] } } }), 'hooks', 'unknown hook type: Stop'));
ck('prompt hook type -> clean (no missing-command)',
  count(run({ settings: { hooks: { Stop: [{ hooks: [{ type: 'prompt', prompt: 'check' }] }] } } }), 'hooks') === 0);
{ // CRLF + trailing-space frontmatter fences must still parse
  const root = tmp(); const cfg = path.join(root, '.claude');
  fs.mkdirSync(path.join(cfg, 'skills', 'foo'), { recursive: true });
  writeJSON(path.join(cfg, 'settings.json'), {});
  fs.writeFileSync(path.join(cfg, 'skills', 'foo', 'SKILL.md'), '--- \r\nname: foo\r\ndescription: d\r\n--- \r\nbody\r\n');
  ck('CRLF+trailing-space frontmatter parsed', count(audit(cfg), 'frontmatter') === 0);
}

/* ---------------- directory-source version drift ---------------- */
function mkWithSourceVersion(srcVer, instVer) {
  const root = tmp(); const cfg = path.join(root, '.claude'); fs.mkdirSync(cfg, { recursive: true });
  const mkDir = path.join(root, 'mk'); fs.mkdirSync(path.join(mkDir, '.claude-plugin'), { recursive: true });
  writeJSON(path.join(mkDir, '.claude-plugin', 'marketplace.json'), { plugins: [{ name: 'foo', source: './foo', version: srcVer }] });
  writeJSON(path.join(cfg, 'settings.json'), { extraKnownMarketplaces: { mymk: { source: { source: 'directory', path: mkDir } } } });
  writeJSON(path.join(cfg, 'plugins', 'installed_plugins.json'), { plugins: { 'foo@mymk': [{ installPath: mkDir, version: instVer }] } });
  return audit(cfg);
}
ck('version drift: installed behind source -> warning',
  hasFinding(mkWithSourceVersion('2.0.0', '1.0.0'), 'marketplace', 'plugin out of date: foo@mymk'));
ck('version match -> no out-of-date finding',
  !hasFinding(mkWithSourceVersion('2.0.0', '2.0.0'), 'marketplace', 'plugin out of date'));
ck('version drift: installed ahead of source -> no false out-of-date (numeric compare, not string)',
  !hasFinding(mkWithSourceVersion('1.9.0', '1.10.0'), 'marketplace', 'plugin out of date'));

/* ---------------- relative script paths resolve against configDir (no false positive) ---------------- */
{ // C8 relative hook path that exists under configDir -> NOT flagged
  const root = tmp(); const cfg = path.join(root, '.claude');
  withReal(cfg, path.join('hooks', 'rel.js'));
  writeJSON(path.join(cfg, 'settings.json'), { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'node "hooks/rel.js"' }] }] } });
  ck('C8 relative hook path under configDir -> no false positive', count(audit(cfg), 'hooks') === 0);
}
{ // C9 relative hook path that exists nowhere -> still an error
  const r = run({ settings: { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'node "hooks/ghost-xyz-nope.js"' }] }] } } });
  ck('C9 relative hook path missing -> error', hasFinding(r, 'hooks', 'hook script missing: PreToolUse'));
}
{ // D5 relative statusLine path under configDir -> NOT flagged
  const root = tmp(); const cfg = path.join(root, '.claude');
  withReal(cfg, 'status.js');
  writeJSON(path.join(cfg, 'settings.json'), { statusLine: { command: 'node "status.js"' } });
  ck('D5 relative statusLine under configDir -> no false positive', count(audit(cfg), 'statusline') === 0);
}

/* ---------------- O. settings.local.json content (not just JSON validity) ---------------- */
{ // O1 broken hook script in settings.local.json -> error
  const r = run({ settings: {}, extra: (cfg) => writeJSON(path.join(cfg, 'settings.local.json'),
    { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-local-hook-xyz.js')}"` }] }] } }) });
  ck('O1 broken hook in settings.local.json -> error', hasFinding(r, 'hooks', 'hook script missing: PreToolUse'));
}
{ // O2 plugin enabled only in settings.local.json but not installed -> error
  const r = run({ settings: {}, installed: { plugins: {} },
    extra: (cfg) => writeJSON(path.join(cfg, 'settings.local.json'), { enabledPlugins: { 'ghost@m': true } }) });
  ck('O2 local-only enabled, not installed -> error', hasFinding(r, 'plugins', 'enabled but not installed: ghost@m'));
}
{ // O3 malformed permission rule in settings.local.json -> warning
  const r = run({ settings: {}, extra: (cfg) => writeJSON(path.join(cfg, 'settings.local.json'), { permissions: { allow: ['Bash npm'] } }) });
  ck('O3 malformed rule in settings.local.json -> warning', hasFinding(r, 'permissions', 'malformed permission rule: allow'));
}
{ // O4 valid settings.local.json -> no false positive
  const r = run({ settings: {}, extra: (cfg) => writeJSON(path.join(cfg, 'settings.local.json'), { permissions: { allow: ['WebFetch'] }, statusLine: { type: 'command', command: 'echo hi' } }) });
  ck('O4 valid settings.local.json -> clean', r.findings.length === 0);
}
{ // O5 invalid hook event in settings.local.json -> error (structural check runs on local)
  const r = run({ settings: {}, extra: (cfg) => writeJSON(path.join(cfg, 'settings.local.json'), { hooks: { BadEvent: [{ hooks: [{ type: 'command', command: 'echo x' }] }] } }) });
  ck('O5 unknown event in settings.local.json -> error', hasFinding(r, 'hooks', 'unknown hook event: BadEvent'));
}

/* ---------------- P. additive checks (timeout / allow+deny / mcp shape) ---------------- */
{ // hook timeout <= 0 -> warning
  const root = tmp(); const cfg = path.join(root, '.claude');
  const hk = withReal(cfg, path.join('hooks', 'h.js'));
  writeJSON(path.join(cfg, 'settings.json'), { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${hk}"`, timeout: 0 }] }] } });
  ck('P1 hook timeout 0 -> warning', hasFinding(audit(cfg), 'hooks', 'invalid hook timeout: PreToolUse'));
}
{ // valid positive-integer timeout -> clean
  const root = tmp(); const cfg = path.join(root, '.claude');
  const hk = withReal(cfg, path.join('hooks', 'h.js'));
  writeJSON(path.join(cfg, 'settings.json'), { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${hk}"`, timeout: 5 }] }] } });
  ck('P2 hook timeout 5 -> no finding', count(audit(cfg), 'hooks') === 0);
}
{ // same rule in allow and deny -> warning (deny wins)
  const r = run({ settings: { permissions: { allow: ['Bash(rm *)'], deny: ['Bash(rm *)'] } } });
  ck('P3 rule in allow+deny -> warning', hasFinding(r, 'permissions', 'rule in both allow and deny: Bash(rm *)'));
}
{ // MCP server with both command and url -> warning
  const r = run(mcpFix({ mcpServers: { x: { command: 'npx foo', url: 'http://a' } } }));
  ck('P4 MCP command+url -> warning', hasFinding(r, 'mcp', 'MCP server has both command and url: x'));
}

for (const d of CLEANUP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log(`\n${pass}/${pass + fail} scenarios passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
