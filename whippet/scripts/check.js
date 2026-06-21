'use strict';
/*
 * whippet check — a deterministic gate for pre-commit / CI. Composes whippet's own
 * audits (never reimplements them) plus a staged-diff budget. NO LLM.
 *
 * Unlike a hook, a gate FAILS LOUD: it exits non-zero on an error-severity finding
 * AND on its own crash — a green light produced by a bug is the worst outcome.
 *
 * Scope: project deps (whole manifest) + markers/budget over the staged diff
 * (default) or `--range <ref>` (CI). config-audit is opt-in (it audits the Claude
 * setup, not the project).
 *
 * Usage:  node check.js [--deps] [--markers] [--config] [--config-dir <dir>]
 *                       [--staged] [--range <ref>] [--budget N] [--strict] [--json]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function gitOut(args, cwd) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
}
function tryRequire(p) { try { return require(p); } catch { return null; } }

const MARK_SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mov', '.lockb']);

function diffNames(root, opts) {
  return opts.range ? gitOut(['diff', '--name-only', opts.range], root)
    : gitOut(['diff', '--staged', '--name-only'], root);
}
function diffNumstat(root, opts) {
  return opts.range ? gitOut(['diff', '--numstat', opts.range], root)
    : gitOut(['diff', '--staged', '--numstat'], root);
}
function stagedNewDeps(root, opts) {
  // match the diff baseline used by diffNames/diffNumstat: --range is worktree-vs-ref (so the
  // "current" side is the working tree), default is index-vs-HEAD (the staged side).
  let cur, base;
  if (opts.range) {
    try { cur = fs.readFileSync(path.join(root, 'package.json'), 'utf8'); } catch { cur = null; }
    base = gitOut(['show', `${opts.range}:package.json`], root);
  } else {
    cur = gitOut(['show', ':package.json'], root);
    base = gitOut(['show', 'HEAD:package.json'], root);
  }
  if (cur === null) return null; // package.json not in the diff scope
  const keys = (txt) => { try { const p = JSON.parse(txt); return new Set([...Object.keys(p.dependencies || {}), ...Object.keys(p.devDependencies || {})]); } catch { return new Set(); } };
  const before = base === null ? new Set() : keys(base);
  const after = keys(cur);
  return [...after].filter(d => !before.has(d));
}

function run(opts = {}) {
  const root = opts.dir || process.cwd();
  const strict = !!opts.strict;
  const findings = [];
  const ran = [];
  const skipped = [];
  const add = (severity, category, title, detail, fix, evidence) =>
    findings.push({ severity, category, title, detail, fix, evidence });

  const want = {
    deps: opts.deps !== false,
    markers: opts.markers !== false,
    config: opts.config === true || !!opts.configDir,
    budget: typeof opts.budget === 'number',
  };

  // deps — audit the project manifest (always whole-manifest; conservative)
  if (want.deps) {
    const mod = tryRequire('./deps-audit.js');
    if (mod) { for (const f of mod.audit(root).findings) findings.push({ ...f, check: 'deps' }); ran.push('deps'); }
    else skipped.push(['deps', 'deps-audit unavailable']);
  }

  // markers — bare whippet: markers in the changed files
  if (want.markers) {
    const mod = tryRequire('./marker.js');
    if (!mod) skipped.push(['markers', 'marker.js unavailable']);
    else {
      const names = diffNames(root, opts);
      if (names === null) skipped.push(['markers', 'not a git repo / git unavailable']);
      else {
        for (const rel of names.split('\n').filter(Boolean)) {
          if (MARK_SKIP_EXT.has(path.extname(rel).toLowerCase())) continue;
          let txt;
          if (opts.range) { // worktree side of `git diff <ref>`
            try { const full = path.join(root, rel); if (fs.statSync(full).size > 512 * 1024) continue; txt = fs.readFileSync(full, 'utf8'); }
            catch { continue; }
          } else { // read the STAGED blob, not the worktree, so content matches the --staged name list
            txt = gitOut(['show', `:${rel}`], root);
            if (txt === null || txt.length > 512 * 1024) continue;
          }
          for (const m of mod.scanMarkers(txt)) {
            if (m.bare) add('error', 'markers', `bare whippet: marker — ${rel}:${m.line}`,
              `"${m.shortcut}" names no | until: ceiling`, 'add | until: <condition>, or resolve the shortcut', `${rel}:${m.line}`);
          }
        }
        ran.push('markers');
      }
    }
  }

  // budget — staged/range diff size + new dependency (warning; error under --strict)
  if (want.budget) {
    const numstat = diffNumstat(root, opts);
    if (numstat === null) skipped.push(['budget', 'not a git repo / git unavailable']);
    else {
      let added = 0;
      for (const line of numstat.split('\n')) { const m = line.match(/^(\d+)\t\d+\t/); if (m) added += Number(m[1]); }
      if (added > opts.budget) add(strict ? 'error' : 'warning', 'budget', `diff adds ${added} lines (> ${opts.budget})`,
        'a large single commit is harder to review — AI-written bugs slip past big batches',
        'split into smaller logical commits, or raise the budget', 'diff');
      const newDeps = stagedNewDeps(root, opts);
      for (const d of (newDeps || [])) add(strict ? 'error' : 'warning', 'budget', `new dependency added: ${d}`,
        'a new dependency is a standing maintenance cost — confirm the platform or an installed package does not already cover it',
        'justify it in one line, or drop it (see /whippet-deps)', 'package.json');
      ran.push('budget');
    }
  }

  // config — opt-in; only if a Claude config dir is actually present here
  if (want.config) {
    const mod = tryRequire('./config-audit.js');
    const cfgDir = opts.configDir || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    if (mod && fs.existsSync(path.join(cfgDir, 'settings.json'))) {
      for (const f of mod.audit(cfgDir).findings) findings.push({ ...f, check: 'config' });
      ran.push('config');
    } else skipped.push(['config', mod ? `no settings.json at ${cfgDir}` : 'config-audit unavailable']);
  }

  // a requested check that could not run: info, or error under --strict
  for (const [name, reason] of skipped)
    add(strict ? 'error' : 'info', 'check', `${strict ? 'check could not run' : 'skipped'}: ${name}`, reason, 'fix the environment or drop the flag', name);

  const summary = { error: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return { summary, findings, ran };
}

function render(report) {
  const { summary, findings, ran } = report;
  const order = { error: 0, warning: 1, info: 2 };
  const icon = { error: 'ERROR', warning: 'WARN ', info: 'INFO ' };
  const head = `whippet check — ${summary.error} error · ${summary.warning} warning · ${summary.info} info` + (ran.length ? `   (ran: ${ran.join(', ')})` : '');
  const lines = [head, ''];
  if (!findings.length) lines.push('clean — nothing to flag.');
  for (const f of [...findings].sort((a, b) => order[a.severity] - order[b.severity])) {
    lines.push(`[${icon[f.severity]}] ${f.title}`);
    if (f.detail) lines.push(`         ${f.detail}`);
    if (f.fix) lines.push(`         fix: ${f.fix}`);
  }
  return lines.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  // a flag's value can't be another flag or absent — otherwise `--range --strict` would read
  // "--strict" as the ref, and `--range` at the end would silently fall back to --staged scope.
  const valOf = (f) => { const i = argv.indexOf(f); if (i === -1) return undefined; const v = argv[i + 1]; return (v === undefined || v.startsWith('--')) ? undefined : v; };
  for (const f of ['--range', '--config-dir', '--budget']) {
    if (has(f) && valOf(f) === undefined) { process.stderr.write(`whippet check: ${f} needs a value\n`); process.exit(1); }
  }
  const opts = { strict: has('--strict'), json: has('--json'), configDir: valOf('--config-dir'), range: valOf('--range') };
  const sel = ['deps', 'markers', 'config'].filter(f => has('--' + f));
  if (sel.length) { opts.deps = sel.includes('deps'); opts.markers = sel.includes('markers'); opts.config = sel.includes('config'); }
  else { opts.deps = true; opts.markers = true; opts.config = false; }
  if (opts.configDir) opts.config = true;
  const b = valOf('--budget'); if (b !== undefined && /^\d+$/.test(b)) opts.budget = Number(b);

  let report;
  try { report = run(opts); }
  catch (e) { process.stderr.write('whippet check crashed: ' + (e && e.message) + '\n'); process.exit(1); }
  process.stdout.write((opts.json ? JSON.stringify(report, null, 2) : render(report)) + '\n');
  process.exit(report.summary.error > 0 ? 1 : 0);
}

module.exports = { run };
