'use strict';
/*
 * marker.js — parse whippet debt markers deterministically.
 *
 * Grammar (backward-compatible):
 *   <comment> whippet: <shortcut>                       -> bare    (no ceiling)
 *   <comment> whippet: <shortcut> | until: <condition>  -> tracked (ceiling named)
 *
 * Free-form text after `whippet:` parses as the shortcut (so today's markers keep
 * classifying as bare), and `git grep "whippet:"` still finds every marker — the
 * `| until:` suffix is invisible to the grep. Comment leads // # -- ; /* <!-- are
 * recognized; a trailing block/HTML closer (*​/ or -->) is stripped.
 *
 * Pure, zero-dep, never throws. Consumed by /whippet-ledger, /whippet-review and
 * `whippet check`.
 *
 * CLI:  node marker.js <file...> [--json]
 */

// `whippet:` at line start, after whitespace, or after a comment lead — never
// inside a word (so `notwhippet:` does not match).
const MARKER = /(?:^|\s)(?:\/\/|#|--|;|\/\*|<!--)?\s*whippet:\s*(.*)$/i;
const UNTIL = /^(.*?)\s*\|\s*until\s*:\s*(.*)$/i;

function parseMarker(line) {
  if (typeof line !== 'string') return null;
  const m = line.match(MARKER);
  if (!m) return null;
  // drop a trailing block / HTML comment closer
  const body = m[1].replace(/\s*(?:\*\/|-->)\s*$/, '').trim();
  const um = body.match(UNTIL);
  if (um) {
    const shortcut = um[1].trim();
    const until = um[2].trim();
    // an unwritten ceiling is not a ceiling
    if (until) return { shortcut, until, bare: false };
    return { shortcut, until: null, bare: true };
  }
  return { shortcut: body, until: null, bare: true };
}

function scanMarkers(text) {
  const out = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const p = parseMarker(lines[i]);
    if (p) out.push({ line: i + 1, raw: lines[i].trim(), shortcut: p.shortcut, until: p.until, bare: p.bare });
  }
  return out;
}

if (require.main === module) {
  const fs = require('fs');
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const files = argv.filter(a => a !== '--json');
  const hits = [];
  for (const f of files) {
    let txt;
    try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const h of scanMarkers(txt)) hits.push({ file: f, ...h });
  }
  if (json) {
    process.stdout.write(JSON.stringify(hits, null, 2));
  } else {
    const tracked = hits.filter(h => !h.bare);
    const bare = hits.filter(h => h.bare);
    const lines = [`CEILING LEDGER — ${hits.length} markers (${tracked.length} tracked, ${bare.length} bare)`];
    if (tracked.length) { lines.push('Tracked:'); for (const h of tracked) lines.push(`  ${h.file}:${h.line} — ${h.shortcut} → upgrade when ${h.until}`); }
    if (bare.length) { lines.push('Bare (add a ceiling):'); for (const h of bare) lines.push(`  ${h.file}:${h.line} — ${h.shortcut}`); }
    if (!hits.length) lines.push('no whippet markers found.');
    process.stdout.write(lines.join('\n') + '\n');
  }
  process.exit(0);
}

module.exports = { parseMarker, scanMarkers };
