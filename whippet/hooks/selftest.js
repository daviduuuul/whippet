#!/usr/bin/env node
// Runnable check for the whippet hooks — whippet applying its own rule
// ("non-trivial logic leaves ONE runnable check") to itself.
// Run: node whippet/hooks/selftest.js
const os = require('os');
const path = require('path');
const fs = require('fs');

// Isolate the flag file in a temp dir so the test never touches real config.
const dir = path.join(os.tmpdir(), 'whippet-selftest');
fs.mkdirSync(dir, { recursive: true });
process.env.CLAUDE_CONFIG_DIR = dir;

const c = require('./whippet-core.js');

let failed = 0;
const check = (name, cond) => {
  if (cond) { console.log('ok    ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
};

check('default mode is full', c.readMode() === 'full');
check('payload reflects mode', c.buildPayload('full').includes('mode: full'));

// The injected payload is the copy the agent actually sees every session; SKILL.md
// is only the spec. Lock the load-bearing anchors so a trim can't silently drop a
// guard the brand (and the commands) depend on. Semantic substrings, not the full
// wording — legitimate rewording stays free.
const payload = c.buildPayload('full');
check('payload keeps the reuse rung', payload.includes('reuse beats rewrite'));
check('payload keeps native-before-library', payload.includes('Native before a library'));
check('payload keeps the security carve-out', payload.includes('never hand-rolled'));
check('payload keeps the runnable-check guard', payload.includes('the one check that catches it breaking'));
check('payload keeps the // whippet: marker rule', payload.includes('// whippet:'));
c.setMode('ultra');
check('setMode persists ultra', c.readMode() === 'ultra');
check('reminder reflects mode', c.buildReminder('ultra').includes('ultra'));
check('detects "/whippet ultra" at start', c.detectModeChange('/whippet ultra now') === 'ultra');
check('detects "whippet lite" at start', c.detectModeChange('whippet lite please') === 'lite');
check('detects "stop whippet" at start', c.detectModeChange('stop whippet please') === 'off');
// Real footgun probes: mid-sentence prose must NEVER flip state (silent diffs).
check('prose: "normal mode" does not toggle', c.detectModeChange('in vim, press escape for normal mode') === null);
check('prose: "back to normal mode" does not toggle', c.detectModeChange('lets switch back to normal mode for the editor') === null);
check('prose: asking "whippet full?" does not toggle', c.detectModeChange('should I use whippet full or whippet lite?') === null);
check('prose: "stop whippet from…" does not toggle', c.detectModeChange('I had to stop whippet from deleting my tests') === null);
check('"ultra mode" alone does not toggle', c.detectModeChange('switch to ultra mode now') === null);
c.setMode('off');
check('off persists', c.readMode() === 'off');
check('rejects invalid mode', (c.setMode('bogus'), c.readMode() === 'off'));

try { fs.unlinkSync(path.join(dir, '.whippet-active')); } catch { /* ignore */ }

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
