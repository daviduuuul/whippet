'use strict';
// whippet-drift-core — shared logic for the code↔docs drift hooks.
// Pure Node builtins, no deps, nothing throws to the caller. Deterministic:
// it classifies edited files and decides whether to surface ONE reminder.

const fs = require('fs');
const path = require('path');

const CODE_EXTS = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go',
  'java', 'kt', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'rb', 'php', 'swift', 'astro',
  'vue', 'svelte', 'css', 'scss', 'sass', 'less', 'html', 'sql', 'sh', 'lua', 'dart',
  'scala', 'clj', 'ex', 'exs', 'toml', 'yaml', 'yml']);
const DOC_EXTS = new Set(['md', 'mdx', 'rst']);
// Notebooks (.ipynb / NotebookEdit) are deliberately out of scope: half-supporting
// them (matched but not classified) is worse than a clean skip. Revisit if asked.

function ext(file) {
  const b = path.basename(String(file));
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1).toLowerCase() : '';
}
function segs(file) { return String(file).split(/[\\/]+/).map(s => s.toLowerCase()); }

// A doc is markdown-ish or anything under a docs/ directory.
function isDoc(file) {
  return DOC_EXTS.has(ext(file)) || segs(file).includes('docs');
}
// Code is a known source extension. Everything else (locks, images, config) is ignored.
function isCode(file) {
  return CODE_EXTS.has(ext(file));
}

function normalizeState(state) {
  const s = state && typeof state === 'object' ? state : {};
  return { code: Array.isArray(s.code) ? s.code.slice() : [], notified: !!s.notified };
}

// Record one edited file. A doc edit closes the wave: the accumulated code is
// considered documented, so we start fresh (this is the per-wave reset).
function recordEdit(state, file) {
  const s = normalizeState(state);
  if (!file) return s;
  if (isDoc(file)) return { code: [], notified: false };
  if (isCode(file) && !s.code.includes(file)) s.code.push(file);
  return s;
}

// Surface a reminder once per wave: when enough code changed and we haven't
// warned yet. A later doc edit resets via recordEdit, re-arming the next wave.
function evaluateDrift(state, { threshold = 3 } = {}) {
  const s = normalizeState(state);
  if (s.code.length >= threshold && !s.notified) {
    const n = s.code.length;
    return {
      notify: true,
      message: `whippet drift: ${n} code files changed this session but no docs `
        + `(CLAUDE.md / README / docs/) were updated. Update them, or confirm it's `
        + `intentional. (silence with WHIPPET_DRIFT_OFF=1)`,
      state: { ...s, notified: true },
    };
  }
  return { notify: false, state: s };
}

// Per-SESSION state file. transcript_path is <project-dir>/<session-id>.jsonl, so
// its dirname is shared across sessions — key the file by session_id to stay isolated.
function statePath(input) {
  const tp = input && input.transcript_path;
  const dir = tp ? path.dirname(String(tp)) : (process.env.CLAUDE_CONFIG_DIR || process.cwd());
  const sid = (input && input.session_id)
    || (tp ? path.basename(String(tp)).replace(/\.[^.]+$/, '') : 'session');
  return path.join(dir, `.whippet-drift-${sid}.json`);
}

// Persist state: atomic temp+rename, with a direct-write fallback (cross-drive
// rename can fail on Windows). Best-effort — a failed write is never fatal.
function writeState(sp, state) {
  const data = JSON.stringify(state);
  try {
    const tmp = sp + '.tmp';
    fs.writeFileSync(tmp, data, { mode: 0o600 });
    fs.renameSync(tmp, sp);
  } catch {
    try { fs.writeFileSync(sp, data, { mode: 0o600 }); } catch { /* give up quietly */ }
  }
}

// All edited file paths in a PostToolUse payload (Edit/Write top-level, MultiEdit edits[]).
function editedFiles(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return [];
  const out = [];
  if (typeof toolInput.file_path === 'string') out.push(toolInput.file_path);
  if (Array.isArray(toolInput.edits)) {
    for (const e of toolInput.edits) if (e && typeof e.file_path === 'string') out.push(e.file_path);
  }
  return out;
}

module.exports = { isDoc, isCode, recordEdit, evaluateDrift, normalizeState, statePath, writeState, editedFiles };
