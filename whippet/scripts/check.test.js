'use strict';
/*
 * Scenario suite for `whippet check`. Real git repos in temp dirs + the CLI via
 * spawnSync, so the exit-code contract (0 clean / 1 error / 1 crash) is asserted,
 * not just run()'s return.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const fails = [];
const CLEANUP = [];
const CHECK = path.join(__dirname, 'check.js');

function tmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-check-')); CLEANUP.push(d); return d; }
function sh(cmd, args, cwd) { return spawnSync(cmd, args, { cwd, encoding: 'utf8' }); }
function gitRepo() { const d = tmp(); sh('git', ['init', '-q'], d); sh('git', ['config', 'user.email', 't@t'], d); sh('git', ['config', 'user.name', 't'], d); return d; }
function write(dir, rel, content) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return p; }
function cli(dir, args) { return spawnSync('node', [CHECK, ...args], { cwd: dir, encoding: 'utf8' }); }
function ck(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); }

{ // 1. clean repo (committed, nothing staged) -> exit 0
  const d = gitRepo();
  write(d, 'package.json', '{"name":"x","version":"1.0.0"}');
  sh('git', ['add', '.'], d); sh('git', ['commit', '-qm', 'init'], d);
  const r = cli(d, ['--staged']);
  ck('1 clean repo -> exit 0', r.status === 0);
}
{ // 2. staged bare marker -> exit 1
  const d = gitRepo();
  write(d, 'foo.js', '// whippet: hack\nconst x = 1;\n');
  sh('git', ['add', 'foo.js'], d);
  const r = cli(d, ['--staged']);
  ck('2 staged bare marker -> exit 1', r.status === 1 && /bare whippet/.test(r.stdout));
}
{ // 3. staged tracked marker (has | until:) -> exit 0
  const d = gitRepo();
  write(d, 'foo.js', '// whippet: hack | until: v2\nconst x = 1;\n');
  sh('git', ['add', 'foo.js'], d);
  const r = cli(d, ['--staged']);
  ck('3 staged tracked marker -> exit 0', r.status === 0);
}
{ // 4. over-budget staged diff -> warning, exit 0
  const d = gitRepo();
  write(d, 'big.js', Array.from({ length: 8 }, (_, i) => `const v${i} = ${i};`).join('\n') + '\n');
  sh('git', ['add', 'big.js'], d);
  const r = cli(d, ['--staged', '--budget', '5']);
  ck('4 over-budget -> warning, exit 0', r.status === 0 && /diff adds 8 lines/.test(r.stdout));
}
{ // 5. over-budget + --strict -> exit 1
  const d = gitRepo();
  write(d, 'big.js', Array.from({ length: 8 }, (_, i) => `const v${i} = ${i};`).join('\n') + '\n');
  sh('git', ['add', 'big.js'], d);
  const r = cli(d, ['--staged', '--budget', '5', '--strict']);
  ck('5 over-budget + strict -> exit 1', r.status === 1);
}
{ // 6. not a git repo -> graceful (markers skipped), exit 0
  const d = tmp();
  const r = cli(d, ['--staged']);
  ck('6 non-git -> exit 0 (skipped)', r.status === 0 && /skipped: markers/.test(r.stdout));
}
{ // 7. not a git repo + --strict -> skipped becomes error, exit 1
  const d = tmp();
  const r = cli(d, ['--staged', '--strict']);
  ck('7 non-git + strict -> exit 1', r.status === 1);
}
{ // 8. --json shape
  const d = gitRepo();
  write(d, 'foo.js', 'const x = 1;\n');
  sh('git', ['add', 'foo.js'], d);
  const r = cli(d, ['--staged', '--json']);
  let ok = false;
  try { const j = JSON.parse(r.stdout); ok = j.summary && typeof j.summary.error === 'number' && Array.isArray(j.findings) && Array.isArray(j.ran); } catch { /* */ }
  ck('8 --json shape valid', ok);
}
{ // 9. new dependency in staged package.json -> budget warning
  const d = gitRepo();
  write(d, 'package.json', '{"name":"x","version":"1.0.0","dependencies":{}}');
  sh('git', ['add', '.'], d); sh('git', ['commit', '-qm', 'init'], d);
  write(d, 'package.json', '{"name":"x","version":"1.0.0","dependencies":{"some-lib":"^1"}}');
  sh('git', ['add', 'package.json'], d);
  const r = cli(d, ['--staged', '--budget', '1000']);
  ck('9 new dependency -> budget warning', /new dependency added: some-lib/.test(r.stdout));
}
{ // 10. selector flag: --deps only runs deps, not markers
  const d = gitRepo();
  write(d, 'foo.js', '// whippet: hack\n');
  sh('git', ['add', 'foo.js'], d);
  const r = cli(d, ['--deps', '--json']);
  let ran = [];
  try { ran = JSON.parse(r.stdout).ran; } catch { /* */ }
  ck('10 --deps only -> ran=[deps], no marker error', ran.includes('deps') && !ran.includes('markers') && r.status === 0);
}
{ // 11. config opt-in via --config-dir: broken hook propagates -> exit 1
  const d = gitRepo();
  const cfg = path.join(d, 'cfg'); fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${path.join(os.tmpdir(), 'no-such-hook-xyz.js')}"` }] }] } }));
  const r = cli(d, ['--config-dir', cfg]);
  ck('11 config broken hook -> exit 1', r.status === 1 && /hook script missing/.test(r.stdout));
}

for (const dir of CLEANUP) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log(`\n${pass}/${pass + fail} check scenarios passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
