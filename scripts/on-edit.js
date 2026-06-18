#!/usr/bin/env node
// Repo dev hook (PostToolUse: Edit|Write): when an edit touches the plugin's
// hooks, the scripts, or a versioned manifest, run the test suite and surface a
// failure straight back to the agent. Whippet dogfooding its own "always-on
// runnable check". Never throws; only speaks up when a check actually fails.
const path = require('path');
const { execFileSync } = require('child_process');

const RELEVANT = /(whippet\/hooks|scripts)\/|package\.json$|marketplace\.json$|plugin\.json$|README\.md$/;

let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const file = (JSON.parse(input || '{}').tool_input || {}).file_path || '';
    if (!RELEVANT.test(file.replace(/\\/g, '/'))) process.exit(0);
    const root = path.join(__dirname, '..');
    const run = (s) => execFileSync(process.execPath, [path.join(root, s)], { cwd: root, stdio: 'pipe' });
    run('whippet/hooks/selftest.js');
    run('scripts/check-manifests.js');
  } catch (e) {
    // A failed suite is the only thing worth saying. Exit 2 feeds stderr back.
    process.stderr.write('whippet repo check failed:\n' + (e.stdout || e.message || ''));
    process.exit(2);
  }
  process.exit(0);
});
