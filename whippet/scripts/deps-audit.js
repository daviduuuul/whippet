'use strict';
/*
 * deps-audit — read-only dependency-leanness auditor for a project.
 * Deterministic facts only (no LLM): a dependency the platform or stdlib already
 * covers, a declared dep nothing imports, two libraries doing the same job.
 * Emits findings; fixes nothing. Conservative by design — it under-reports rather
 * than tell you a working dependency is wrong.
 *
 * Usage:  node deps-audit.js [--dir <projectDir>] [--json]
 * projectDir resolution: --dir  >  cwd   (deps are project-scoped, not the config dir)
 */
const fs = require('fs');
const path = require('path');

function resolveRoot(argv) {
  const i = argv.indexOf('--dir');
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  return process.cwd();
}

function readJSON(p) {
  try { return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) }; }
  catch (e) { return { ok: false, error: e.code === 'ENOENT' ? 'missing' : 'invalid JSON' }; }
}
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function safeReaddir(p) { try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; } }

// Curated ALLOWLIST of genuine 1:1 single-purpose swaps. Multi-purpose libraries
// (lodash, axios, ramda, underscore) are deliberately ABSENT — never suggested.
// sinceNode = the Node major at/after which the native replacement is reliably
// available (rounded up past the exact minor to stay conservative).
const NATIVE = {
  'uuid': { to: 'crypto.randomUUID()', sinceNode: 16, note: 'native covers v4 only; v1/v3/v5/v7 have no native equivalent' },
  'node-uuid': { to: 'crypto.randomUUID()', sinceNode: 16, note: 'native covers v4 only; v1/v3/v5/v7 have no native equivalent' },
  'node-fetch': { to: 'global fetch', sinceNode: 21, note: 'global fetch is experimental on Node 18-20, stable from 21' },
  'cross-fetch': { to: 'global fetch', sinceNode: 21, note: 'global fetch is experimental on Node 18-20, stable from 21' },
  'left-pad': { to: 'String.prototype.padStart', sinceNode: 8 },
  'pad-left': { to: 'String.prototype.padStart', sinceNode: 8 },
  'mkdirp': { to: 'fs.mkdirSync(p, { recursive: true })', sinceNode: 12 },
  'make-dir': { to: 'fs.mkdirSync(p, { recursive: true })', sinceNode: 12 },
  'rimraf': { to: 'fs.rmSync(p, { recursive: true, force: true })', sinceNode: 16 },
  'dotenv': { to: 'node --env-file=.env', sinceNode: 21, note: 'native --env-file lacks dotenv\'s ${VAR} expansion and programmatic parse' },
  'is-odd': { to: 'n % 2 !== 0', sinceNode: 0 },
  'is-even': { to: 'n % 2 === 0', sinceNode: 0 },
  'is-number': { to: "typeof x === 'number' / Number.isFinite", sinceNode: 0, note: 'drops is-number\'s numeric-string acceptance, e.g. is-number("5")' },
  'is-array': { to: 'Array.isArray', sinceNode: 0 },
  'object-assign': { to: 'Object.assign', sinceNode: 6 },
  'object-keys': { to: 'Object.keys', sinceNode: 0 },
  'array-flatten': { to: 'Array.prototype.flat', sinceNode: 12 },
  'querystringify': { to: 'URLSearchParams', sinceNode: 8 },
  'q': { to: 'native Promise', sinceNode: 0 },
  'rfdc': { to: 'structuredClone()', sinceNode: 17, note: 'structuredClone handles Date/Map/Set but not functions or class instances' },
  'clone-deep': { to: 'structuredClone()', sinceNode: 17, note: 'structuredClone handles Date/Map/Set but not functions or class instances' },
  'abort-controller': { to: 'global AbortController', sinceNode: 16 },
  'node-abort-controller': { to: 'global AbortController', sinceNode: 16 },
  'text-encoding': { to: 'global TextEncoder / TextDecoder', sinceNode: 11 },
  'lodash.clonedeep': { to: 'structuredClone()', sinceNode: 17, note: 'structuredClone handles Date/Map/Set but throws on functions and drops class prototypes' },
  'fast-copy': { to: 'structuredClone()', sinceNode: 17, note: 'structuredClone handles Date/Map/Set but throws on functions and drops class prototypes' },
  'isarray': { to: 'Array.isArray', sinceNode: 0 },
  'es6-promise': { to: 'global Promise', sinceNode: 4 },
  'p-defer': { to: 'Promise.withResolvers()', sinceNode: 22 },
  'minimist': { to: 'util.parseArgs', sinceNode: 20, note: 'util.parseArgs is stricter — declare options up front; it throws on unknown flags unless strict:false' },
  'querystring': { to: 'node:querystring / URLSearchParams', sinceNode: 0, note: 'prefer URLSearchParams for new code; node:querystring is legacy but built in' },
};

// "Pick one" groups: two members declared at once is worth a look (info, never blocks).
const DUP_GROUPS = {
  date: ['moment', 'dayjs', 'date-fns', 'luxon', 'js-joda', '@js-temporal/polyfill'],
  'http client': ['axios', 'got', 'node-fetch', 'superagent', 'request', 'ky', 'undici'],
  'test runner': ['jest', 'mocha', 'vitest', 'ava', 'tape', 'jasmine', 'uvu', 'qunit'],
  bundler: ['webpack', 'rollup', 'esbuild', 'parcel', 'vite'],
  validation: ['joi', 'yup', 'zod', 'ajv', 'superstruct', 'valibot', 'io-ts', 'class-validator', 'runtypes'],
  logger: ['winston', 'pino', 'bunyan', 'log4js', 'loglevel', 'signale', 'consola'],
};

const SRC_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.staging', 'out', '.cache']);
const CONFIG_RE = /^(\.eslintrc|eslint\.config|\.prettierrc|prettier\.config|\.babelrc|babel\.config|jest\.config|vitest\.config|vite\.config|webpack\.config|rollup\.config|tailwind\.config|postcss\.config|\.mocharc|commitlint\.config|\.stylelintrc|tsconfig)/i;

// Lowest Node major a project's `engines.node` allows (the floor a user may run on),
// or null if unstated. Conservative: take the minimum major mentioned.
function parseNodeMin(spec) {
  if (typeof spec !== 'string') return null;
  // major of each version token (parseInt stops at the first dot) — a minor/patch
  // must not drag the floor down (">=20.10.0" is Node 20, not min(20,10,0)=0).
  const majors = (spec.match(/\d+(?:\.\d+)*/g) || []).map(v => parseInt(v, 10));
  return majors.length ? Math.min(...majors) : null;
}

// Comment-stripped concatenation of all source files (for import-shaped matching),
// plus the raw text (for the substring escape hatch) and the file count.
function collectSources(root) {
  const stripped = [];
  const raw = [];
  let budget = 5000;
  let truncated = false; // a depth/budget cap stopped the walk -> the read is partial
  const walk = (dir, depth) => {
    if (depth > 12 || budget <= 0) { truncated = true; return; }
    for (const ent of safeReaddir(dir)) {
      if (budget <= 0) { truncated = true; break; }
      if (ent.isDirectory()) { if (!SKIP_DIR.has(ent.name)) walk(path.join(dir, ent.name), depth + 1); continue; }
      if (!SRC_EXT.has(path.extname(ent.name))) continue;
      budget--;
      let txt; try { txt = fs.readFileSync(path.join(dir, ent.name), 'utf8'); } catch { continue; }
      raw.push(txt);
      stripped.push(txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
    }
  };
  walk(root, 0);
  return { count: raw.length, raw: raw.join('\n'), code: stripped.join('\n'), truncated };
}

function readConfigText(root) {
  let txt = '';
  for (const ent of safeReaddir(root)) {
    if (!ent.isDirectory() && CONFIG_RE.test(ent.name)) {
      try { txt += fs.readFileSync(path.join(root, ent.name), 'utf8') + '\n'; } catch { /* skip */ }
    }
  }
  return txt;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// True if `name` is imported in `code` (require / import / dynamic import / subpath) —
// an import-shaped match, not a bare substring (which would hit a string literal).
function usesPkg(code, name) {
  const n = escapeRe(name);
  const re = new RegExp(`(?:require\\(\\s*|import\\(\\s*|from\\s+|import\\s+)['"]${n}(?:/[^'"]*)?['"]`);
  return re.test(code);
}

function audit(root) {
  const findings = [];
  const add = (severity, category, title, detail, fix, evidence) =>
    findings.push({ severity, category, title, detail, fix, evidence });
  const asObj = (x) => (x && typeof x === 'object' && !Array.isArray(x)) ? x : null;

  const pkgPath = path.join(root, 'package.json');
  const pkgR = readJSON(pkgPath);
  if (!pkgR.ok) {
    if (pkgR.error === 'missing') {
      add('info', 'deps', 'no package.json', `nothing to audit at ${pkgPath}`, 'run from a project root, or pass --dir', 'package.json');
      return finalize(root, findings);
    }
    add('error', 'deps', 'package.json invalid JSON', `could not parse ${pkgPath}`, 'fix the JSON syntax', 'package.json');
    return finalize(root, findings);
  }
  const pkg = asObj(pkgR.data);
  if (!pkg) {
    add('error', 'deps', 'package.json is not a JSON object', 'valid JSON but the top level is null / an array / a scalar', 'make package.json a { } object', 'package.json');
    return finalize(root, findings);
  }

  const deps = asObj(pkg.dependencies) || {};
  const devDeps = asObj(pkg.devDependencies) || {};
  const declared = { ...deps, ...devDeps };
  const floor = parseNodeMin(pkg.engines && pkg.engines.node);

  // lockfile presence (evidence only — never parsed)
  const lock = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'].find(f => exists(path.join(root, f)));

  // workspaces: audit root manifest only, say so
  if (pkg.workspaces) {
    add('info', 'deps', 'workspaces detected — audited root manifest only',
      'per-package dependencies in the workspaces were not scanned',
      'run deps-audit in each package dir for full coverage', 'package.json:workspaces');
  }

  // 1. native equivalent available (engine-gated) — over declared deps + devDeps
  for (const name of Object.keys(declared)) {
    const swap = NATIVE[name];
    if (!swap) continue;
    if (floor !== null && floor < swap.sinceNode) continue; // their runtime floor predates the native API
    const verify = floor === null ? ` (verify your runtime is Node >= ${swap.sinceNode})` : '';
    const note = swap.note ? ` — ${swap.note}` : '';
    add('warning', 'native', `native equivalent available: ${name}`,
      `the platform already covers this${verify}${note}`,
      `replace ${name} with ${swap.to}`, lock ? `package.json (lockfile: ${lock})` : 'package.json');
  }

  // 2. declared-but-unused (dependencies only; info + "verify"; silent if no sources)
  const src = collectSources(root);
  // a truncated (partial) scan can't claim "unused" — the import may be in an unread file
  if (src.count > 0 && !src.truncated) {
    const cfg = readConfigText(root);
    const meta = JSON.stringify([pkg.scripts, pkg.bin, pkg.main, pkg.exports]);
    const peerOpt = { ...(asObj(pkg.peerDependencies) || {}), ...(asObj(pkg.optionalDependencies) || {}) };
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@types/')) continue;          // type-only, never imported by name
      if (peerOpt[name]) continue;                        // intentional pin alongside a peer/optional
      if (usesPkg(src.code, name)) continue;              // imported somewhere
      if (meta.includes(name)) continue;                  // used in bin/scripts/main/exports
      if (cfg.includes(name)) continue;                   // named in a lint/test/build config
      if (src.raw.includes(name)) continue;               // any substring in sources (dynamic loaders, plugin strings)
      add('info', 'unused', `possibly unused dependency: ${name}`,
        'declared in dependencies but no import found in scanned sources — verify before removing (a dynamic require or runtime-only use can be missed without an AST)',
        `confirm it is unused, then remove ${name}`, 'package.json:dependencies');
    }
  }

  // 3. duplicate-purpose (over declared deps + devDeps)
  for (const [purpose, members] of Object.entries(DUP_GROUPS)) {
    const present = members.filter(m => declared[m]);
    if (present.length >= 2) {
      add('info', 'duplicate', `multiple ${purpose} libraries: ${present.join(', ')}`,
        `${present.length} libraries cover the same job`,
        `pick one ${purpose} library and drop the rest`, 'package.json');
    }
  }

  return finalize(root, findings);
}

function finalize(dir, findings) {
  const summary = { error: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return { dir, summary, findings };
}

function render(report) {
  const { summary, findings, dir } = report;
  const order = { error: 0, warning: 1, info: 2 };
  const icon = { error: 'ERROR', warning: 'WARN ', info: 'INFO ' };
  const lines = [`deps-audit — ${dir}`,
    `${summary.error} error · ${summary.warning} warning · ${summary.info} info`, ''];
  if (!findings.length) lines.push('clean — no avoidable dependencies detected.');
  for (const f of [...findings].sort((a, b) => order[a.severity] - order[b.severity])) {
    lines.push(`[${icon[f.severity]}] ${f.title}`);
    lines.push(`         ${f.detail}`);
    lines.push(`         fix: ${f.fix}`);
  }
  return lines.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const report = audit(resolveRoot(argv));
  if (argv.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2));
  else process.stdout.write(render(report) + '\n');
  process.exit(report.summary.error > 0 ? 1 : 0);
}

module.exports = { audit, usesPkg, parseNodeMin, resolveRoot };
