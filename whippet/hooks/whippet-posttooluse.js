'use strict';
// PostToolUse(Edit|Write|MultiEdit): ONE node spawn doing both per-edit jobs, so a
// hot path (every edit) launches a single process instead of two:
//   1) track edited code files for the code↔docs drift wave (silent — the Stop hook
//      surfaces the reminder), off with WHIPPET_DRIFT_OFF=1;
//   2) when package.json changed, surface new native-equivalent / duplicate deps
//      findings (deduped per session), off with WHIPPET_DEPS_OFF=1.
// Non-blocking, never throws, streams stdin so it never blocks on a fd that doesn't close.
const fs = require('fs');
const { editedFiles, recordEdit, statePath, sessionStatePath, writeState } = require('./whippet-drift-core');
const { pkgDirs, inlineFindings, freshFindings, advisory } = require('./whippet-deps-core');

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* no/bad stdin */ }
  const files = editedFiles(input && input.tool_input);

  // 1) drift tracking — silent; records the wave for the Stop hook to evaluate.
  try {
    if (!process.env.WHIPPET_DRIFT_OFF && files.length) {
      const sp = statePath(input);
      let state = {};
      try { state = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { /* fresh */ }
      for (const f of files) state = recordEdit(state, f);
      writeState(sp, state);
    }
  } catch { /* never break a session */ }

  // 2) deps advisory — only when a package.json was edited.
  try {
    if (!process.env.WHIPPET_DEPS_OFF) {
      const dirs = pkgDirs(files);
      if (dirs.length) {
        const { audit } = require('../scripts/deps-audit.js');
        const found = [];
        for (const d of dirs) found.push(...inlineFindings(audit(d).findings));
        const sp = sessionStatePath(input, 'deps');
        let seen = [];
        try { seen = JSON.parse(fs.readFileSync(sp, 'utf8')).seen || []; } catch { /* fresh */ }
        const fresh = freshFindings(found, seen);
        if (fresh.length) {
          process.stdout.write(JSON.stringify({ systemMessage: advisory(fresh) }));
          writeState(sp, { seen: [...seen, ...fresh.map((f) => f.title)] });
        }
      }
    }
  } catch { /* never break a session */ }

  process.exit(0);
});
