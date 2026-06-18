#!/usr/bin/env node
// Repo integrity check: the version lives in four places (package.json,
// plugin.json, marketplace.json, the README badge) and the plugin's hooks.json
// points at real files. This fails the build before a desynced release ships.
// Run: node scripts/check-manifests.js   (part of `npm test`)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const r = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const json = (...p) => JSON.parse(r(...p));

let failed = 0;
const check = (name, cond) => {
  if (cond) console.log('ok    ' + name);
  else { failed++; console.error('FAIL  ' + name); }
};

// package.json is the source of truth for the version.
const version = json('package.json').version;
check('package.json has a version', !!version);

check('plugin.json version matches', json('whippet/.claude-plugin/plugin.json').version === version);

const market = json('.claude-plugin/marketplace.json');
check('marketplace.json plugin version matches', market.plugins?.[0]?.version === version);

check('README badge version matches', r('README.md').includes(`version-${version}-`));

// Every hook command must reference a file that actually exists in the plugin.
const pluginRoot = path.join(root, 'whippet');
const hooks = json('whippet/hooks/hooks.json');
const refs = [];
for (const group of Object.values(hooks.hooks || {}))
  for (const entry of group)
    for (const h of entry.hooks || []) {
      const m = String(h.command).match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/);
      if (m) refs.push(m[1]);
    }
check('hooks.json references at least one file', refs.length > 0);
for (const ref of refs)
  check(`hooks.json target exists: ${ref}`, fs.existsSync(path.join(pluginRoot, ref)));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall manifest checks passed');
process.exit(failed ? 1 : 0);
