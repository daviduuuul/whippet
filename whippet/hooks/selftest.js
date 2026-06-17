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
c.setMode('ultra');
check('setMode persists ultra', c.readMode() === 'ultra');
check('reminder reflects mode', c.buildReminder('ultra').includes('ultra'));
check('detects "/whippet ultra"', c.detectModeChange('please /whippet ultra now') === 'ultra');
check('detects "stop whippet"', c.detectModeChange('ok stop whippet please') === 'off');
check('no false toggle on prose', c.detectModeChange('use whippet for the parser') === null);
c.setMode('off');
check('off persists', c.readMode() === 'off');
check('rejects invalid mode', (c.setMode('bogus'), c.readMode() === 'off'));

try { fs.unlinkSync(path.join(dir, '.whippet-active')); } catch { /* ignore */ }

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
