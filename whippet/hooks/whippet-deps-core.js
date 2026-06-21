'use strict';
// whippet-deps-core — pure helpers for the autonomous deps advisory hook.
// Zero deps, nothing throws. The heavy lifting is in scripts/deps-audit.js; this
// only decides which package.json dirs were touched, what's new this session, and
// how to phrase the one-line advisory.
const path = require('path');

// Directories of edited package.json files (deduped).
function pkgDirs(files) {
  const out = [];
  for (const f of files || []) {
    if (path.basename(String(f)) === 'package.json') {
      const d = path.dirname(String(f));
      if (!out.includes(d)) out.push(d);
    }
  }
  return out;
}

// Findings worth surfacing inline: a native-equivalent or a duplicate-purpose
// package (high-signal the moment you add it). "unused" is left for the on-demand
// audit — right after an edit it's noisy and often wrong.
function inlineFindings(findings) {
  return (findings || []).filter((f) => f.category === 'native' || f.category === 'duplicate');
}

// Of those, the ones not already surfaced this session (keyed by title).
function freshFindings(findings, seen) {
  const seenSet = new Set(seen || []);
  return findings.filter((f) => !seenSet.has(f.title));
}

// One quiet, self-contained advisory line (no command to run — it tells you here).
function advisory(findings) {
  const n = findings.length;
  const top = findings.slice(0, 3).map((f) => f.fix ? `${f.title} → ${f.fix}` : f.title).join('; ');
  return `whippet deps (${n}): ${top}${n > 3 ? ` (+${n - 3} more)` : ''}. (off: WHIPPET_DEPS_OFF=1)`;
}

module.exports = { pkgDirs, inlineFindings, freshFindings, advisory };
