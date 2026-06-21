'use strict';
// PostToolUse(Edit|Write|MultiEdit): when package.json changed, run the dependency
// audit and surface NEW native-equivalent / duplicate findings once each (deduped
// per session). Non-blocking (systemMessage + exit 0), never throws. Streams stdin
// so it never blocks on a fd 0 that doesn't close. Off with WHIPPET_DEPS_OFF=1.
const fs = require('fs');
const { editedFiles, sessionStatePath, writeState } = require('./whippet-drift-core');
const { pkgDirs, inlineFindings, freshFindings, advisory } = require('./whippet-deps-core');

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    if (!process.env.WHIPPET_DEPS_OFF) {
      let input = {};
      try { input = JSON.parse(raw || '{}'); } catch { /* no/bad stdin */ }
      const dirs = pkgDirs(editedFiles(input && input.tool_input));
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
