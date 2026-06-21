'use strict';
/*
 * config-audit — read-only drift detector for a Claude Code config dir.
 * Deterministic facts only (no LLM): what's enabled vs installed, broken
 * references, fragile sources, orphaned files. Emits findings; fixes nothing.
 * Reads settings.json AND settings.local.json (overrides accumulate the same rot).
 *
 * Usage:  node config-audit.js [--dir <configDir>] [--json]
 * configDir resolution: --dir  >  $CLAUDE_CONFIG_DIR  >  ~/.claude
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function resolveConfigDir(argv) {
  const i = argv.indexOf('--dir');
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
  return path.join(os.homedir(), '.claude');
}

function readJSON(p) {
  // strip a UTF-8 BOM (Windows editors add one) before parsing
  try { return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) }; }
  catch (e) { return { ok: false, error: e.code === 'ENOENT' ? 'missing' : 'invalid JSON' }; }
}
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function safeReaddir(p) { try { return fs.readdirSync(p); } catch { return []; } }

// A hook/statusLine script path may be absolute or relative; Claude Code resolves
// a relative one against the config dir. Treat it as present if it exists either
// relative to configDir or as given (cwd-relative) — only flag when neither does,
// so a working relative path is never a false positive.
function scriptMissing(sp, configDir) {
  if (path.isAbsolute(sp)) return !exists(sp);
  return !exists(path.join(configDir, sp)) && !exists(sp);
}

// Pull a script-file path out of a hook/statusLine command string, if any.
function extractScriptPath(cmd) {
  if (typeof cmd !== 'string') return null;
  const q = cmd.match(/"([^"]+\.(?:ps1|mjs|cjs|js|py|sh))"/i);
  const sp = q ? q[1] : (cmd.match(/(\S+\.(?:ps1|mjs|cjs|js|py|sh))(?:\s|$)/i) || [])[1];
  if (!sp) return null;
  // can't be checked statically: a runtime-resolved path (${CLAUDE_PLUGIN_ROOT}, %VAR%)
  // or a glob argument (e.g. a formatter over src/**/*.js — never a single literal file)
  if (/[$%*?]/.test(sp)) return null;
  return sp;
}

// Recognized hook events / MCP transports — a value outside these fails silently.
// The documented hook events (code.claude.com/docs/en/hooks). This set grows over time,
// so the check below only flags a NEAR-MISS of one (a likely typo) and stays silent on an
// unknown-but-far name — a newer event we don't list must never become a false positive.
const HOOK_EVENTS = new Set(['SessionStart', 'Setup', 'UserPromptSubmit', 'UserPromptExpansion',
  'PreToolUse', 'PermissionRequest', 'PermissionDenied', 'PostToolUse', 'PostToolUseFailure',
  'PostToolBatch', 'Notification', 'MessageDisplay', 'SubagentStart', 'SubagentStop', 'TaskCreated',
  'TaskCompleted', 'Stop', 'StopFailure', 'TeammateIdle', 'InstructionsLoaded', 'ConfigChange',
  'CwdChanged', 'FileChanged', 'WorktreeCreate', 'WorktreeRemove', 'PreCompact', 'PostCompact',
  'Elicitation', 'ElicitationResult', 'SessionEnd']);
const MCP_TRANSPORTS = new Set(['stdio', 'http', 'streamable-http', 'sse', 'ws']);
const HOOK_TYPES = new Set(['command', 'prompt', 'agent', 'http', 'mcp_tool']);
// Closed-set enums: a typo silently reverts to the default, which the schema can't catch at runtime.
const DEFAULT_MODES = new Set(['default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions']);
const UPDATE_CHANNELS = new Set(['stable', 'latest']);

// Top-level settings keys whose typo is invisible: the JSON stays valid, Claude Code
// just ignores the unknown key, so a misspelled structural key (enabledPlugin,
// statusline) silently disables a whole feature. We flag an unknown key ONLY when it's
// a single edit from one of these high-value targets and the correct spelling is absent
// — a near-zero-false-positive "did you mean". KNOWN_SETTINGS_KEYS are recognized and
// skipped; an unknown key far from every target stays silent, so a newer Claude Code key
// we don't list never becomes a false positive.
const SETTINGS_TYPO_TARGETS = ['permissions', 'hooks', 'enabledPlugins', 'extraKnownMarketplaces',
  'statusLine', 'outputStyle', 'enabledMcpjsonServers', 'disabledMcpjsonServers', 'includeCoAuthoredBy',
  'cleanupPeriodDays', 'autoUpdatesChannel', 'enableAllProjectMcpServers', 'additionalDirectories', 'model', 'env'];
const KNOWN_SETTINGS_KEYS = new Set([...SETTINGS_TYPO_TARGETS,
  '$schema', 'apiKeyHelper', 'forceLoginMethod', 'awsAuthRefresh', 'awsCredentialExport', 'disableAllHooks',
  'disableBypassPermissionsMode', 'preferredNotifChannel', 'spinnerTipsEnabled', 'messageIdleNotifThresholdMs',
  'alwaysThinkingEnabled', 'todoFeatureEnabled', 'verbose', 'mcpServers']);

// Damerau-Levenshtein (optimal string alignment): counts an adjacent transposition as a
// single edit, so "modle"->"model" is distance 1. Used for both the settings-key and the
// hook-event typo checks. Strings here are short identifiers, so the full DP is cheap.
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// MCP servers live in .mcp.json (project) / .claude.json (user), not settings.json.
function collectMcp(configDir) {
  const servers = {};
  for (const file of ['.mcp.json', '.claude.json']) {
    const r = readJSON(path.join(configDir, file));
    if (r.ok && r.data && r.data.mcpServers && typeof r.data.mcpServers === 'object') {
      Object.assign(servers, r.data.mcpServers);
    }
  }
  return servers;
}

// Names of components of a given kind under baseDir (default-folder convention).
function componentNames(baseDir, type) {
  const dir = path.join(baseDir, type);
  const names = new Set();
  for (const ent of safeReaddir(dir)) {
    if (type === 'skills') {
      if (exists(path.join(dir, ent, 'SKILL.md'))) names.add(ent);
    } else if (ent.endsWith('.md')) {
      names.add(ent.slice(0, -3));
    }
  }
  return names;
}

// Top-level keys of a markdown file's YAML frontmatter; null if there's none.
function frontmatterKeys(filePath) {
  let txt;
  try { txt = fs.readFileSync(filePath, 'utf8'); } catch { return null; }
  const m = txt.match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*---/);
  if (!m) return null;
  const keys = new Set();
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z][\w-]*):/);
    if (km) keys.add(km[1]);
  }
  return keys;
}

// Compare dotted version strings numerically (1.10 > 1.9, which a string compare
// gets backwards). Tolerates a leading "v" and SemVer prerelease tags: a release
// outranks its prerelease (1.2.0 > 1.2.0-beta). Missing/non-numeric parts count as
// 0. Returns <0 / 0 / >0.
function cmpSemver(a, b) {
  const norm = (v) => String(v).trim().replace(/^v/i, '').split('-');
  const [ca, ...preA] = norm(a), [cb, ...preB] = norm(b);
  const pa = ca.split('.'), pb = cb.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
    if (d) return d;
  }
  const ra = preA.join('-'), rb = preB.join('-'); // prerelease tag, '' for a release
  if (ra === rb) return 0;
  if (!ra) return 1;          // a is a release, b is a prerelease -> a is newer
  if (!rb) return -1;         // a is a prerelease, b is a release -> a is older
  return ra < rb ? -1 : 1;    // both prerelease: lexical (conservative, good enough)
}

// A permission rule is `ToolName` optionally followed by `(pattern)`. Tool names
// can carry dots and double-underscores (e.g. mcp__server__tool, vendor.tool). MCP
// rules also take a documented trailing wildcard (mcp__server__*, mcp__server__get_*);
// a bare unanchored mcp__* stays rejected, matching Claude Code's own behavior.
const PERMISSION_RULE = /^[A-Za-z][A-Za-z0-9_.-]*(\([\s\S]*\))?$|^mcp__[A-Za-z0-9_.-]+__[A-Za-z0-9_.-]*\*$/;

function audit(configDir) {
  const findings = [];
  const add = (severity, category, title, detail, fix, evidence) =>
    findings.push({ severity, category, title, detail, fix, evidence });
  // a plain object, else null — guards against valid-JSON-but-wrong-shape (null, array, scalar)
  const asObj = (x) => (x && typeof x === 'object' && !Array.isArray(x)) ? x : null;

  const settings = readJSON(path.join(configDir, 'settings.json'));
  if (!settings.ok) {
    add('error', 'config', `settings.json ${settings.error}`,
      `could not read ${path.join(configDir, 'settings.json')}`,
      'restore or fix settings.json', 'settings.json');
  } else if (!asObj(settings.data)) {
    add('error', 'config', 'settings.json is not a JSON object',
      'valid JSON but the top level is null / an array / a scalar',
      'make settings.json a { } object', 'settings.json');
  }
  const s = asObj(settings.data) || {};

  // settings.local.json overrides settings.json; its hooks/statusLine/permissions/
  // plugins are part of the effective config, so they get the same structural checks.
  const localR = readJSON(path.join(configDir, 'settings.local.json'));
  const local = localR.ok ? asObj(localR.data) : null;

  const installed = readJSON(path.join(configDir, 'plugins', 'installed_plugins.json'));
  const installedOk = !!(installed.ok && asObj(installed.data) && asObj(installed.data.plugins));
  const installedPlugins = installedOk ? installed.data.plugins : {};
  if (s.enabledPlugins != null && !asObj(s.enabledPlugins)) {
    add('error', 'config', 'enabledPlugins is not an object',
      'settings.json:enabledPlugins must map "name@marketplace" to true/false',
      'fix the enabledPlugins shape', 'settings.json:enabledPlugins');
  }
  // local wins per key, matching Claude Code precedence, so a plugin enabled only
  // in settings.local.json is still checked against what's installed.
  const enabled = { ...(asObj(s.enabledPlugins) || {}), ...(local ? asObj(local.enabledPlugins) || {} : {}) };
  const anyEnabled = Object.values(enabled).some(v => v === true);

  // If the inventory is unreadable, say so once — don't flag every plugin.
  if (!installedOk && anyEnabled) {
    add('error', 'plugins', `installed_plugins.json ${installed.error || 'unreadable'}`,
      'cannot verify enabled plugins against what is actually installed',
      'restore plugins/installed_plugins.json', 'plugins/installed_plugins.json');
  }

  // 1. enabled vs installed (+ cache path on disk)
  if (installedOk) {
    for (const [key, on] of Object.entries(enabled)) {
      if (on !== true) continue;
      const inst = installedPlugins[key];
      if (!Array.isArray(inst) || inst.length === 0) {
        add('error', 'plugins', `enabled but not installed: ${key}`,
          'settings.json enables it but it is absent from installed_plugins.json',
          'install the plugin, or remove it from enabledPlugins', 'settings.json:enabledPlugins');
        continue;
      }
      const ip = inst[0].installPath;
      if (!ip || !exists(ip)) {
        add('error', 'plugins', `cache path missing: ${key}`,
          `installPath is missing or not on disk: ${ip}`,
          'reinstall the plugin to repair the cache', String(ip));
      }
    }
  }
  // installed but not enabled — dead weight
  for (const key of Object.keys(installedPlugins)) {
    if (enabled[key] !== true) {
      add('info', 'plugins', `installed but not enabled: ${key}`,
        'present in installed_plugins.json but not active in settings.json',
        'enable it, or uninstall to reclaim space', 'installed_plugins.json');
    }
  }

  // 2. local directory-source marketplaces are fragile / can be broken
  const mk = asObj(s.extraKnownMarketplaces) || {};
  for (const [name, def] of Object.entries(mk)) {
    const src = def && def.source;
    // accept both nested { source: { source:'directory', path } } and flat { source:'directory', path }
    const kind = src && typeof src === 'object' ? src.source : src;
    if (kind !== 'directory') continue;
    const p = src && typeof src === 'object' ? src.path : def.path;
    if (!p || !exists(p)) {
      add('error', 'marketplace', `local marketplace path missing: ${name}`,
        `directory-source points to a path that does not exist: ${p || '(none)'}`,
        'restore the folder, or repoint/remove the marketplace', p || '(no path)');
    } else {
      add('warning', 'marketplace', `fragile local marketplace: ${name}`,
        `sourced from a local folder (${p}); moving or renaming it breaks the plugin silently`,
        'publish to git, or keep the path stable and documented', p);
    }
  }

  // 2b. directory-source marketplace: installed version behind the source's marketplace.json
  for (const [name, def] of Object.entries(mk)) {
    const src = def && def.source;
    const kind = src && typeof src === 'object' ? src.source : src;
    if (kind !== 'directory') continue;
    const p = src && typeof src === 'object' ? src.path : def.path;
    if (!p || !exists(p)) continue;
    const srcMk = readJSON(path.join(p, '.claude-plugin', 'marketplace.json'));
    if (!srcMk.ok || !srcMk.data || !Array.isArray(srcMk.data.plugins)) continue;
    for (const pl of srcMk.data.plugins) {
      if (!pl || !pl.name || !pl.version) continue;
      const key = `${pl.name}@${name}`;
      const inst = installedPlugins[key];
      const iv = Array.isArray(inst) && inst[0] && inst[0].version;
      if (iv && cmpSemver(iv, pl.version) < 0) {
        add('warning', 'marketplace', `plugin out of date: ${key}`,
          `installed ${iv}, but the local source is ${pl.version}`,
          'run /plugin update to sync the cache', key);
      }
    }
  }

  // 3. structural checks that apply to any settings object — run for both
  //    settings.json and settings.local.json (label keeps the evidence honest).
  function checkStructured(cfgObj, label) {
    const o = asObj(cfgObj);
    if (!o) return;

    // typo'd top-level key: valid JSON, but an unknown key is silently ignored, so a
    // misspelled structural key disables a whole feature with no error. Flag a single-edit
    // near-miss of a known target — whether or not the correct key is present (a typo sitting
    // next to the real key is a dead near-duplicate, still worth surfacing).
    for (const key of Object.keys(o)) {
      if (KNOWN_SETTINGS_KEYS.has(key)) continue;
      const hit = SETTINGS_TYPO_TARGETS.find(t => editDistance(key, t) === 1);
      if (hit) {
        const dead = hit in o; // the correctly-spelled key is also present
        add('warning', 'settings', `unknown settings key: ${key}`,
          dead ? `not a recognized setting, so it is silently ignored — a stray near-duplicate of "${hit}", which is also present`
            : `not a recognized setting, so it is silently ignored — likely a typo of "${hit}"`,
          dead ? `remove the stray "${key}"` : `rename "${key}" to "${hit}"`, `${label}:${key}`);
      }
    }

    // hooks: unknown event name, bad matcher, missing command, missing script
    const hooks = asObj(o.hooks) || {};
    for (const [event, groups] of Object.entries(hooks)) {
      if (!HOOK_EVENTS.has(event)) {
        // a near-miss of a known event is a confident typo (error); an unknown-but-far name is
        // probably wrong but could be a newer event we don't list yet, so it's only a warning —
        // the autonomous SessionStart advisory speaks on errors, so it never false-alarms on a new event.
        const near = [...HOOK_EVENTS].find(e => editDistance(event, e) <= 2);
        if (near) {
          add('error', 'hooks', `unknown hook event: ${event}`,
            `not a recognized hook event, so the hook never fires — likely a typo of "${near}"`,
            `use "${near}" (or another valid event)`, `${label}:hooks.${event}`);
        } else {
          add('warning', 'hooks', `unknown hook event: ${event}`,
            'not a recognized hook event — if it is a typo the hook never fires; if it is a newer event, ignore',
            'check the name against the current hooks docs', `${label}:hooks.${event}`);
        }
      }
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        if (g && g.matcher != null) {
          // matcher is match-all ("*"/""), an exact/pipe list (letters|digits|_|"|"), or else a
          // JS regex (code.claude.com/docs/en/hooks) — only the regex form can be malformed.
          const mt = String(g.matcher);
          if (mt !== '*' && mt !== '' && !/^[\w|]+$/.test(mt)) {
            try { new RegExp(mt); }
            catch {
              add('error', 'hooks', `invalid hook matcher: ${event}`,
                `the matcher is not a valid regex: ${mt}`,
                'fix the matcher pattern', `${label}:hooks.${event}`);
            }
          }
        }
        for (const h of (g && g.hooks) || []) {
          if (h && h.type && !HOOK_TYPES.has(h.type)) {
            add('warning', 'hooks', `unknown hook type: ${event}`,
              `hook type "${h.type}" is not recognized, so the hook does nothing`,
              'use command, prompt, agent, or http', `${label}:hooks.${event}`);
          }
          if (h && h.type === 'command' && !h.command) {
            add('error', 'hooks', `hook missing command: ${event}`,
              'a command-type hook has no command string',
              'add a command or remove the hook', `${label}:hooks.${event}`);
            continue;
          }
          const sp = extractScriptPath(h && h.command);
          if (sp && scriptMissing(sp, configDir)) {
            add('error', 'hooks', `hook script missing: ${event}`,
              `a ${event} hook command points to a file that does not exist: ${sp}`,
              'fix the path or remove the hook', `${label}:hooks.${event}`);
          }
          // timeout is a positive number of seconds (int or fractional); absent uses a default
          if (h && h.timeout !== undefined && (typeof h.timeout !== 'number' || !(h.timeout > 0))) {
            add('warning', 'hooks', `invalid hook timeout: ${event}`,
              `timeout must be a positive number of seconds; got ${JSON.stringify(h.timeout)}`,
              'set a positive number, or remove it to use the default', `${label}:hooks.${event}`);
          }
        }
      }
    }

    // statusLine pointing at a missing script
    if (o.statusLine && o.statusLine.command) {
      const sp = extractScriptPath(o.statusLine.command);
      if (sp && scriptMissing(sp, configDir)) {
        add('error', 'statusline', 'statusLine script missing',
          `statusLine command points to a missing file: ${sp}`,
          'fix the path or remove statusLine', `${label}:statusLine`);
      }
    }

    // malformed permission rules (silently ignored, so a guard may not apply)
    const perms = asObj(o.permissions) || {};
    for (const key of ['allow', 'deny', 'ask']) {
      if (!Array.isArray(perms[key])) continue;
      for (const rule of perms[key]) {
        if (typeof rule !== 'string' || !PERMISSION_RULE.test(rule)) {
          add('warning', 'permissions', `malformed permission rule: ${key}`,
            `${JSON.stringify(rule)} is not a valid rule (expected ToolName or ToolName(pattern))`,
            'fix the rule shape', `${label}:permissions.${key}`);
        }
      }
    }
    // a rule in both allow and deny — deny wins, so the allow is dead weight
    const denySet = new Set((Array.isArray(perms.deny) ? perms.deny : []).filter((r) => typeof r === 'string'));
    for (const rule of (Array.isArray(perms.allow) ? perms.allow : [])) {
      if (typeof rule === 'string' && denySet.has(rule)) {
        add('warning', 'permissions', `rule in both allow and deny: ${rule}`,
          'deny wins, so this allow rule never takes effect',
          'remove it from allow or from deny', `${label}:permissions`);
      }
    }

    // closed-set enums + statusLine type (a typo silently reverts to default / goes inert)
    if (o.permissions && o.permissions.defaultMode !== undefined && !DEFAULT_MODES.has(o.permissions.defaultMode)) {
      add('warning', 'settings', `invalid permissions.defaultMode: ${o.permissions.defaultMode}`,
        'not a recognized mode; Claude Code silently falls back to default',
        `use one of: ${[...DEFAULT_MODES].join(', ')}`, `${label}:permissions.defaultMode`);
    }
    if (o.autoUpdatesChannel !== undefined && !UPDATE_CHANNELS.has(o.autoUpdatesChannel)) {
      add('warning', 'settings', `invalid autoUpdatesChannel: ${o.autoUpdatesChannel}`,
        'not a recognized channel', `use one of: ${[...UPDATE_CHANNELS].join(', ')}`, `${label}:autoUpdatesChannel`);
    }
    if (o.statusLine && o.statusLine.type && o.statusLine.type !== 'command') {
      add('warning', 'statusline', `statusLine type not 'command': ${o.statusLine.type}`,
        'only "command" is supported, so the statusLine is inert',
        'set statusLine.type to "command"', `${label}:statusLine.type`);
    }
  }
  checkStructured(s, 'settings.json');
  checkStructured(local, 'settings.local.json');

  // 3b. MCP servers (.mcp.json / .claude.json): invalid transport / missing command|url
  for (const [name, def] of Object.entries(collectMcp(configDir))) {
    if (!def || typeof def !== 'object') continue;
    if (def.type && !MCP_TRANSPORTS.has(def.type)) {
      add('warning', 'mcp', `invalid MCP transport: ${name}`,
        `type "${def.type}" is not a known transport`,
        `use one of: ${[...MCP_TRANSPORTS].join(', ')}`, `mcpServers.${name}.type`);
    }
    if (def.command && def.url) {
      add('warning', 'mcp', `MCP server has both command and url: ${name}`,
        'a stdio command and an http url are mutually exclusive — one is ignored',
        'keep only the field for the intended transport', `mcpServers.${name}`);
    }
    // a bogus type is not a usable transport — fall through to command/url so a server with an
    // unknown type AND no command/url still gets the 'no transport' error, not just the warning
    const type = MCP_TRANSPORTS.has(def.type) ? def.type : (def.command ? 'stdio' : (def.url ? 'http' : undefined));
    if (type === 'stdio' && !def.command) {
      add('error', 'mcp', `MCP server missing command: ${name}`,
        'a stdio MCP server has no command to launch', 'add the command', `mcpServers.${name}.command`);
    }
    if (['http', 'streamable-http', 'sse', 'ws'].includes(type) && !def.url) {
      add('error', 'mcp', `MCP server missing url: ${name}`,
        `a ${type} MCP server has no url`, 'add the server url', `mcpServers.${name}.url`);
    }
    if (!type) {
      add('error', 'mcp', `MCP server has no transport: ${name}`,
        'no command (stdio), url (http/sse), or type — nothing to launch or connect to',
        'add a command, a url, or a type', `mcpServers.${name}`);
    }
  }

  // 3c. other config files that exist but don't parse
  for (const file of ['settings.local.json', '.mcp.json', '.claude.json']) {
    const p = path.join(configDir, file);
    if (!exists(p)) continue;
    const r = readJSON(p);
    if (!r.ok && r.error === 'invalid JSON') {
      add('error', 'config', `${file} invalid JSON`,
        `could not parse ${p}`, 'fix the JSON syntax', file);
    }
  }

  // 5. backup files left loose in the config-dir ROOT (leftovers / bloat). A dedicated
  //    backups/ subdir is good hygiene and is NOT flagged — only strays in the root,
  //    aggregated into one finding. A data archive (e.g. *-archive.jsonl) is not a backup.
  const BACKUP_RE = /\.(bak|backup|orig|old)(\.|$)|~$/i;
  const strays = safeReaddir(configDir).filter((e) => BACKUP_RE.test(e));
  if (strays.length) {
    const shown = strays.slice(0, 3).join(', ') + (strays.length > 3 ? `, +${strays.length - 3} more` : '');
    add('info', 'stale', `${strays.length} backup file(s) loose in the config dir`,
      `leftovers in the config-dir root (${shown}) bloat it; a dedicated backups/ subdir keeps them tidy`,
      'move them into a backups/ subdir, or delete them', 'config dir root');
  }

  // 6. local component (skill/agent/command) shadowing a plugin's
  for (const type of ['skills', 'agents', 'commands']) {
    const localComp = componentNames(configDir, type);
    if (!localComp.size) continue;
    for (const [key, arr] of Object.entries(installedPlugins)) {
      const ip = Array.isArray(arr) && arr[0] && arr[0].installPath;
      if (!ip) continue;
      const provided = componentNames(ip, type);
      for (const name of localComp) {
        if (provided.has(name)) {
          add('warning', 'duplicate', `local ${type.slice(0, -1)} shadows plugin: ${name}`,
            `a local ${type} "${name}" collides with one provided by ${key}`,
            'rename or remove the local copy', `${type}/${name}`);
        }
      }
    }
  }

  // 7. plugin manifest: missing, unparseable, or referencing a path that's gone
  for (const [key, arr] of Object.entries(installedPlugins)) {
    const ip = Array.isArray(arr) && arr[0] && arr[0].installPath;
    if (!ip || !exists(ip)) continue;
    const mpath = path.join(ip, '.claude-plugin', 'plugin.json');
    // Lean plugins (LSP shims, etc.) legitimately ship no manifest at the install
    // path — verified against real installs — so absence alone is not an error.
    if (!exists(mpath)) continue;
    const m = readJSON(mpath);
    if (!m.ok) {
      add('error', 'manifest', `plugin manifest invalid: ${key}`,
        `cannot parse plugin.json (${m.error})`, 'reinstall the plugin', mpath);
      continue;
    }
    for (const f of ['hooks', 'commands', 'agents', 'skills', 'mcpServers']) {
      const v = m.data[f];
      const items = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);
      for (const item of items) {
        if (typeof item !== 'string' || !item.startsWith('.')) continue;
        if (!exists(path.join(ip, item))) {
          add('error', 'manifest', `manifest path missing: ${key}`,
            `${f} references a path that does not exist: ${item}`,
            'fix the manifest or reinstall the plugin', path.join(ip, item));
        }
      }
    }
  }

  // 9. local skill/agent/command frontmatter: missing required keys
  const fmSpecs = [
    { type: 'skills', kind: 'skill', required: ['name', 'description'], mustHave: true },
    { type: 'agents', kind: 'agent', required: ['name', 'description'], mustHave: true },
    { type: 'commands', kind: 'command', required: ['description'], mustHave: false },
  ];
  for (const { type, kind, required, mustHave } of fmSpecs) {
    for (const name of componentNames(configDir, type)) {
      const fp = type === 'skills'
        ? path.join(configDir, type, name, 'SKILL.md')
        : path.join(configDir, type, name + '.md');
      const keys = frontmatterKeys(fp);
      if (keys === null) {
        if (mustHave) {
          add('warning', 'frontmatter', `${kind} has no frontmatter: ${name}`,
            `a local ${kind} is missing its --- frontmatter`,
            `add frontmatter with ${required.join(', ')}`, fp);
        }
        continue;
      }
      const missing = required.filter(k => !keys.has(k));
      if (missing.length) {
        add('warning', 'frontmatter', `${kind} frontmatter missing ${missing.join('/')}: ${name}`,
          `a local ${kind}'s frontmatter lacks: ${missing.join(', ')}`,
          `add ${missing.join(' and ')}`, fp);
      }
    }
  }

  const summary = { error: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return { configDir, summary, findings };
}

function render(report) {
  const { summary, findings, configDir } = report;
  const order = { error: 0, warning: 1, info: 2 };
  const icon = { error: 'ERROR', warning: 'WARN ', info: 'INFO ' };
  const lines = [`config-audit — ${configDir}`,
    `${summary.error} error · ${summary.warning} warning · ${summary.info} info`, ''];
  if (!findings.length) lines.push('clean — no drift detected.');
  for (const f of [...findings].sort((a, b) => order[a.severity] - order[b.severity])) {
    lines.push(`[${icon[f.severity]}] ${f.title}`);
    lines.push(`         ${f.detail}`);
    lines.push(`         fix: ${f.fix}`);
  }
  return lines.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const report = audit(resolveConfigDir(argv));
  if (argv.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2));
  else process.stdout.write(render(report) + '\n');
  process.exit(report.summary.error > 0 ? 1 : 0);
}

module.exports = { audit, extractScriptPath, resolveConfigDir };
