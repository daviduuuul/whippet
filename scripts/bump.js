#!/usr/bin/env node
// Bump the version in every place it lives, atomically and in sync.
// Usage: npm run bump 1.3.0   (or: node scripts/bump.js 1.3.0)
// Edits the field in place (no JSON reformat), then leaves git tag/commit to you.
const fs = require('fs');
const path = require('path');

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(next || '')) {
  console.error('Usage: npm run bump <version>   e.g. npm run bump 1.3.0');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const old = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (old === next) { console.error(`Already at ${next}.`); process.exit(1); }

const sub = (file, find, repl) => {
  const p = path.join(root, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = before.replace(find, repl);
  if (after === before) { console.error(`No version field changed in ${file}`); process.exit(1); }
  fs.writeFileSync(p, after);
};

const versionField = /("version":\s*")[^"]+(")/;
sub('package.json', versionField, `$1${next}$2`);
sub('whippet/.claude-plugin/plugin.json', versionField, `$1${next}$2`);
sub('.claude-plugin/marketplace.json', versionField, `$1${next}$2`);
sub('README.md', `version-${old}-`, `version-${next}-`);

console.log(`Bumped ${old} -> ${next}.`);
console.log(`Next: npm test, then  git commit -am "release: v${next}" && git tag v${next}`);
