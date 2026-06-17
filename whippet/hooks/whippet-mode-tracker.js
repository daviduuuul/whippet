#!/usr/bin/env node
// UserPromptSubmit hook: (1) flip mode on "/whippet <level>" or "stop whippet",
// (2) re-inject a compact reminder every turn so the discipline survives
// compaction and competing plugins. Reads the prompt JSON on stdin.
// Never throws and never blocks the prompt.

let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const { readMode, setMode, detectModeChange, buildReminder } = require('./whippet-core.js');
    let prompt = '';
    try { prompt = JSON.parse(input || '{}').prompt || ''; } catch { prompt = input || ''; }

    const change = detectModeChange(prompt);
    if (change) setMode(change);

    const mode = readMode();
    if (mode !== 'off') {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: buildReminder(mode),
        },
      }));
    }
  } catch {
    /* no-op: degrade silently */
  }
  process.exit(0);
});
