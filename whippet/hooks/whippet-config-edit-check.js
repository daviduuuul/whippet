#!/usr/bin/env node
'use strict';
// PreToolUse + PostToolUse (Edit|Write) advisory for edits to settings.json / settings.local.json.
// Goal: when an edit INTRODUCES a new error, surface ONE quiet line — where "new" means present
// after the edit but NOT before it. The PreToolUse run snapshots the edited file's error signatures
// (the file is still pre-edit on disk); the PostToolUse run re-audits and reports only the errors
// the edit added, scoped to THAT file — so a pre-existing error elsewhere (e.g. in .mcp.json) is
// never misattributed to this edit. Same engine as /whippet-config and the SessionStart check;
// warnings/info stay silent (they wait for /whippet-config, so this never nags). Advisory only:
// exit 0, never blocks the edit, never throws. Off with WHIPPET_CONFIG_OFF=1.
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_FILES = new Set(['settings.json', 'settings.local.json']);
const PHASE = process.argv[2] === 'pre' ? 'pre' : 'post';
const sanitize = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');

// Signature = category + title + evidence + detail. Including detail is what keeps two distinct
// errors that share a title AND an evidence label (e.g. two different broken hooks under one event —
// same `settings.json:hooks.PostToolUse` evidence, but the detail names the specific missing script)
// from collapsing into one, so fixing hook A while introducing hook B is still reported. detail is
// deterministic from the config, so an unchanged error keeps a stable signature (no spurious "new").
const sigOf = (f) => JSON.stringify([f.category, f.title, f.evidence, f.detail]);

// A finding belongs to the edited file when its evidence is labelled with that file's name.
// Findings with no file label (e.g. an mcpServers.* error sourced from .mcp.json) are NOT
// attributable to a settings.json edit, so the advisory never blames the wrong file.
const belongsTo = (f, base) => {
  const ev = String(f.evidence || '');
  return ev === base || ev.startsWith(base + ':');
};

function baselinePath(sessionId, base) {
  return path.join(os.tmpdir(), `whippet-edit-base-${sanitize(sessionId)}-${sanitize(base)}.json`);
}

// Error signatures attributable to `base` in the current on-disk state of configDir. Returns null
// if the audit cannot run, so the caller can stay silent rather than guess.
function errorSigs(configDir, base) {
  let report;
  try { report = require('../scripts/config-audit.js').audit(configDir); } catch { return null; }
  const sigs = [];
  for (const f of report.findings) {
    if (f.severity === 'error' && belongsTo(f, base)) sigs.push(sigOf(f));
  }
  return sigs;
}

function main(input) {
  if (process.env.WHIPPET_CONFIG_OFF) return;
  const evt = JSON.parse(input || '{}');
  const filePath = (evt.tool_input || {}).file_path || '';
  const base = path.posix.basename(String(filePath).replace(/\\/g, '/'));
  if (!CONFIG_FILES.has(base)) return;

  const configDir = path.dirname(filePath);
  const stash = baselinePath(evt.session_id, base);

  if (PHASE === 'pre') {
    // Snapshot the pre-edit error set for this file; say nothing.
    const before = errorSigs(configDir, base);
    if (before) { try { fs.writeFileSync(stash, JSON.stringify(before)); } catch { /* best effort */ } }
    return;
  }

  // PHASE === 'post': compare the post-edit state to the pre-edit snapshot.
  const after = errorSigs(configDir, base);
  if (!after) return;

  let before = null;
  try { before = JSON.parse(fs.readFileSync(stash, 'utf8')); } catch { before = null; }
  try { fs.unlinkSync(stash); } catch { /* best effort */ }
  if (!Array.isArray(before)) return; // no reliable pre-edit baseline -> stay silent, don't misattribute

  const beforeSet = new Set(before);
  const introduced = after.filter((s) => !beforeSet.has(s));
  if (introduced.length === 0) return;

  process.stdout.write(
    `whippet config: this edit introduced ${introduced.length} new error(s) in ${base}` +
    ` — run /whippet-config for details. (off: WHIPPET_CONFIG_OFF=1)`);
}

let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => { try { main(input); } catch { /* degrade silently */ } process.exit(0); });
