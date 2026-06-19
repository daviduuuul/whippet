#!/usr/bin/env node
// UserPromptSubmit hook: flip mode on "/whippet <level>" or "stop whippet", and
// acknowledge that switch by re-injecting the reminder. Persistence across
// compaction is SessionStart's job — it fires on `compact` and re-anchors the
// full payload. Re-paying a reminder on every normal turn was a token tax that
// whippet's own rung 1 ("can it be skipped?") says to cut. Reads the prompt JSON
// on stdin. Never throws and never blocks the prompt.

let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const { readMode, setMode, detectModeChange, buildReminder } = require('./whippet-core.js');
    let prompt = '';
    try { prompt = JSON.parse(input || '{}').prompt || ''; } catch { prompt = input || ''; }

    // Normal turn: do nothing — no per-turn token tax. Only a mode change
    // re-injects, to acknowledge the switch in-context for this turn.
    const change = detectModeChange(prompt);
    if (change) {
      setMode(change);
      const mode = readMode();
      if (mode !== 'off') {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: buildReminder(mode),
          },
        }));
      }
    }
  } catch {
    /* no-op: degrade silently */
  }
  process.exit(0);
});
