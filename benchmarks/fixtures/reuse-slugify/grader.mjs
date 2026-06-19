// Hidden grader for reuse-slugify. Imports the candidate's titleToSlug and
// checks behavior. Run: CANDIDATE=<dir> node grader.mjs  — exit 0 = pass.
import assert from 'node:assert/strict';
import { loadCandidate } from '../_load.mjs';

const dir = process.env.CANDIDATE;
if (!dir) { console.error('set CANDIDATE=<candidate dir>'); process.exit(2); }

const mod = await loadCandidate(dir, 'src/api.js');

const cases = [
  ['Hello, World!', 'hello-world'],
  ['  Spaced  Out  ', 'spaced-out'],
  ['Already-Slug', 'already-slug'],
  ['Multiple   spaces & punctuation!', 'multiple-spaces-punctuation'],
];
for (const [input, want] of cases)
  assert.equal(mod.titleToSlug(input), want, `titleToSlug(${JSON.stringify(input)})`);

console.log('grader: pass');
