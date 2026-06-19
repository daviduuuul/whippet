// Hidden grader for stdlib-uuid. Run: CANDIDATE=<dir> node grader.mjs — exit 0 = pass.
import assert from 'node:assert/strict';
import { loadCandidate } from '../_load.mjs';

const dir = process.env.CANDIDATE;
if (!dir) { console.error('set CANDIDATE=<candidate dir>'); process.exit(2); }

const { newId } = await loadCandidate(dir, 'src/id.js');

const a = newId();
assert.equal(typeof a, 'string', 'newId() returns a string');
assert.ok(a.length >= 8, 'id is long enough to be unique');
const ids = new Set(Array.from({ length: 1000 }, () => newId()));
assert.equal(ids.size, 1000, 'ids do not collide');

console.log('grader: pass');
