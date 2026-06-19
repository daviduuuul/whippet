// Hidden grader for yagni-config. Run: CANDIDATE=<dir> node grader.mjs — exit 0 = pass.
// getPort() must read the env at call time, so set it before importing too.
import assert from 'node:assert/strict';
import { loadCandidate } from '../_load.mjs';

const dir = process.env.CANDIDATE;
if (!dir) { console.error('set CANDIDATE=<candidate dir>'); process.exit(2); }

delete process.env.PORT;
const { getPort } = await loadCandidate(dir, 'src/config.js');

assert.equal(getPort(), 3000, 'defaults to 3000 when PORT is unset');
process.env.PORT = '8080';
assert.equal(getPort(), 8080, 'reads PORT and returns a number');

console.log('grader: pass');
