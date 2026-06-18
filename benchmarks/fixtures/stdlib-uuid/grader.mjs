// Hidden grader for stdlib-uuid. Run: CANDIDATE=<dir> node grader.mjs — exit 0 = pass.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = process.env.CANDIDATE;
if (!dir) { console.error('set CANDIDATE=<candidate dir>'); process.exit(2); }

const { newId } = await import(pathToFileURL(path.resolve(dir, 'src/id.js')).href);

const a = newId();
assert.equal(typeof a, 'string', 'newId() returns a string');
assert.ok(a.length >= 8, 'id is long enough to be unique');
const ids = new Set(Array.from({ length: 1000 }, () => newId()));
assert.equal(ids.size, 1000, 'ids do not collide');

console.log('grader: pass');
