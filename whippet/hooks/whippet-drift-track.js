'use strict';
// PostToolUse(Edit|Write|MultiEdit): record edited files into session state.
// Silent, never throws, always exits 0.
const fs = require('fs');
const { recordEdit, statePath, writeState, editedFiles } = require('./whippet-drift-core');

try {
  if (!process.env.WHIPPET_DRIFT_OFF) {
    let input = {};
    try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* no stdin */ }
    const files = editedFiles(input && input.tool_input);
    if (files.length) {
      const sp = statePath(input);
      let state = {};
      try { state = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { /* fresh */ }
      for (const f of files) state = recordEdit(state, f);
      writeState(sp, state);
    }
  }
} catch { /* never break a session */ }
process.exit(0);
