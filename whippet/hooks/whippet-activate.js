#!/usr/bin/env node
// SessionStart hook: inject the whippet anchor once per session (and after
// compaction). Never throws — a broken hook must not break the session.
try {
  const { readMode, buildPayload } = require('./whippet-core.js');
  const mode = readMode();
  if (mode !== 'off') process.stdout.write(buildPayload(mode));
} catch {
  /* no-op: degrade silently */
}
process.exit(0);
