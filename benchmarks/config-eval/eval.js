'use strict';
/*
 * config-audit value eval — detection (recall) and false-positive (precision) of the
 * CONTENT checks on a LABELED corpus of realistic Claude Code configs. Each scenario
 * is a settings.json (+ optional settings.local.json / .mcp.json) with a ground-truth
 * list of planted drift (kind + the exact offending token) — or an empty list for a
 * fully-valid config. We materialize the files, run config-audit, and match findings
 * to the labels.
 *
 * Only CONTENT categories are scored — the filesystem-dependent checks (plugins,
 * manifests, marketplaces, orphaned components, backups) need an install tree the
 * corpus doesn't model, so their findings are out of scope here.
 *
 *   node eval.js <corpus.json>   score, print recall/precision + misses + false positives
 *   node eval.js --selftest      validate the matcher on a tiny built-in corpus
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { audit } = require('../../whippet/scripts/config-audit');

// planted-issue kind -> the config-audit finding category that should detect it
const KIND_CATEGORY = {
  typo_top_level_key: 'settings',
  malformed_permission_rule: 'permissions',
  allow_deny_overlap: 'permissions',
  invalid_default_mode: 'settings',
  invalid_autoupdates_channel: 'settings',
  invalid_statusline_type: 'statusline',
  unknown_hook_event: 'hooks',
  invalid_hook_matcher: 'hooks',
  hook_missing_command: 'hooks',
  invalid_hook_timeout: 'hooks',
  unknown_hook_type: 'hooks',
  duplicate_hook_command: 'hooks',
  enabledplugins_not_object: 'config',
  mcp_invalid_transport: 'mcp',
  mcp_no_transport: 'mcp',
  mcp_command_and_url: 'mcp',
  mcp_missing_command: 'mcp',
  mcp_missing_url: 'mcp',
};
// content checks we score; everything else (plugins/manifest/marketplace/stale/duplicate/frontmatter) is out of scope
const IN_SCOPE = new Set(['settings', 'permissions', 'hooks', 'mcp', 'statusline', 'config']);

const hay = (f) => `${f.title} ${f.detail} ${f.evidence}`;

function findingsFor(scenario) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-eval-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(scenario.settings));
  if (scenario.settingsLocal) fs.writeFileSync(path.join(dir, 'settings.local.json'), JSON.stringify(scenario.settingsLocal));
  if (scenario.mcp) fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify(scenario.mcp));
  const findings = audit(dir).findings;
  fs.rmSync(dir, { recursive: true, force: true });
  return findings;
}

function scoreScenario(s) {
  const findings = findingsFor(s);
  // 'script missing' (hook/statusLine) is filesystem-dependent — the corpus references real-looking
  // script paths that don't exist in the temp sandbox, so those findings are eval artifacts, not
  // content false-positives. Excluded from scope like the plugin/manifest checks.
  const inScope = findings.filter(f => IN_SCOPE.has(f.category) && !/script missing/.test(f.title));
  const issues = s.issues || [];
  // recall: each planted issue matched by >=1 finding of the mapped category naming its token
  const misses = [];
  for (const is of issues) {
    const cat = KIND_CATEGORY[is.kind];
    const matched = inScope.some(f => f.category === cat && hay(f).includes(is.token));
    if (!matched) misses.push({ scenario: s.id, kind: is.kind, token: is.token, note: is.note });
  }
  // precision: in-scope findings that match no planted issue are false positives
  const fps = [];
  for (const f of inScope) {
    const matched = issues.some(is => KIND_CATEGORY[is.kind] === f.category && hay(f).includes(is.token));
    if (!matched) fps.push({ scenario: s.id, category: f.category, severity: f.severity, title: f.title });
  }
  return { planted: issues.length, detected: issues.length - misses.length, misses, fps };
}

function run(corpusPath) {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  let planted = 0, detected = 0;
  const misses = [], fps = [];
  for (const s of corpus.scenarios) {
    const r = scoreScenario(s);
    planted += r.planted; detected += r.detected;
    misses.push(...r.misses); fps.push(...r.fps);
  }
  const recall = planted ? detected / planted : 1;
  console.log(`scenarios=${corpus.scenarios.length}  planted=${planted}`);
  console.log(`detected=${detected}/${planted}  recall=${(recall * 100).toFixed(1)}%`);
  console.log(`false positives (in-scope findings with no planted issue): ${fps.length}`);
  console.log(`\nMISSES (planted drift config-audit did not detect): ${misses.length}`);
  for (const m of misses) console.log(`  [${m.kind}] token="${m.token}" (${m.scenario}) :: ${m.note}`);
  console.log(`\nFALSE POSITIVES (flagged valid config): ${fps.length}`);
  for (const f of fps) console.log(`  [${f.severity}|${f.category}] ${f.title} (${f.scenario})`);
  fs.writeFileSync(path.join(path.dirname(corpusPath), 'disagreements.json'),
    JSON.stringify({ recall, planted, detected, misses, fps }, null, 2));
}

function selftest() {
  const corpus = { scenarios: [
    { id: 'a', settings: { enabledPlugin: { 'p@m': true }, permissions: { allow: ['Bash(rm', 'mcp__srv__*'], deny: [] } },
      issues: [
        { kind: 'typo_top_level_key', token: 'enabledPlugin', note: '' },
        { kind: 'malformed_permission_rule', token: 'Bash(rm', note: 'unbalanced' },
      ] },
    { id: 'b', settings: { permissions: { allow: ['mcp__srv__*', 'Bash(npm run *)'], defaultMode: 'plan' }, model: 'sonnet', env: { FOO: '1' } },
      issues: [] },
  ] };
  let ok = true;
  const say = (c, n) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) ok = false; };
  const a = scoreScenario(corpus.scenarios[0]);
  say(a.detected === 2 && a.misses.length === 0, 'detects typo key + malformed rule, no miss');
  say(a.fps.length === 0, 'valid mcp wildcard in scenario a is not a false positive');
  const b = scoreScenario(corpus.scenarios[1]);
  say(b.fps.length === 0, 'fully-valid config b yields zero false positives');
  return ok;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--selftest')) process.exit(selftest() ? 0 : 1);
  if (!a[0]) { console.error('usage: node eval.js <corpus.json> | --selftest'); process.exit(2); }
  run(a[0]);
}
module.exports = { scoreScenario, KIND_CATEGORY };
