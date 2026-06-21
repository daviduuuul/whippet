'use strict';
// Stop: if code changed this session but no docs did, surface ONE yellow advisory.
// Non-blocking (systemMessage + exit 0), never throws. Streams stdin so the Stop
// hook never blocks waiting on a fd 0 that may not close promptly.
const fs = require('fs');
const { evaluateDrift, statePath, writeState } = require('./whippet-drift-core');

// How many code edits pile up in a wave before a doc-drift advisory fires. Tune with
// WHIPPET_DRIFT_THRESHOLD (a positive integer); default 3, and any junk value falls back to 3.
function threshold() {
  const raw = process.env.WHIPPET_DRIFT_THRESHOLD;
  if (raw === undefined) return 3;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 3;
}

let rawIn = '';
process.stdin.on('data', (d) => { rawIn += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    if (!process.env.WHIPPET_DRIFT_OFF) {
      let input = {};
      try { input = JSON.parse(rawIn || '{}'); } catch { /* no/bad stdin */ }
      const sp = statePath(input);
      let state = {};
      try { state = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { /* nothing tracked */ }
      const res = evaluateDrift(state, { threshold: threshold() });
      writeState(sp, res.state);
      if (res.notify) process.stdout.write(JSON.stringify({ systemMessage: res.message }));
    }
  } catch { /* never break a session */ }
  process.exit(0);
});
