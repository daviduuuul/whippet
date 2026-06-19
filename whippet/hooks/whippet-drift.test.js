'use strict';
// Scenario suite for the drift core: classification, accumulation, the
// one-reminder-per-wave decision, the doc-reset re-arming, and payload parsing.
const { isDoc, isCode, recordEdit, evaluateDrift, statePath, editedFiles } = require('./whippet-drift-core');

let pass = 0, fail = 0; const fails = [];
function ck(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); }

// classification
ck('isDoc CLAUDE.md', isDoc('a/b/CLAUDE.md'));
ck('isDoc README.md', isDoc('README.md'));
ck('isDoc under docs/', isDoc('docs/guide.txt'));
ck('isDoc .mdx', isDoc('x/page.mdx'));
ck('isCode .ts', isCode('src/app.ts'));
ck('isCode .py', isCode('main.py'));
ck('code not doc', isCode('a.js') && !isDoc('a.js'));
ck('lockfile is neither', !isDoc('package-lock.json') && !isCode('package-lock.json'));
ck('.md is doc not code', isDoc('notes.md') && !isCode('notes.md'));
ck('config-as-code .yml/.toml/.yaml', isCode('ci.yml') && isCode('config.toml') && isCode('app.yaml'));

// recordEdit accumulation + doc reset
{
  let s = {};
  s = recordEdit(s, 'src/a.ts');
  s = recordEdit(s, 'src/b.ts');
  s = recordEdit(s, 'src/a.ts');            // dup
  ck('dedup code files', s.code.length === 2);
  s = recordEdit(s, 'package-lock.json');   // ignored
  ck('non-code/doc ignored', s.code.length === 2);
  s = recordEdit(s, 'README.md');           // doc closes the wave
  ck('doc edit resets code', s.code.length === 0 && s.notified === false);
}

// evaluateDrift decision
ck('below threshold -> no notify', evaluateDrift({ code: ['a.ts', 'b.ts'] }, { threshold: 3 }).notify === false);
{
  const r = evaluateDrift({ code: ['a.ts', 'b.ts', 'c.ts'] }, { threshold: 3 });
  ck('at threshold -> notify', r.notify === true && /3 code files/.test(r.message));
  ck('notify sets notified flag', r.state.notified === true);
}
ck('already notified -> silent', evaluateDrift({ code: ['a.ts', 'b.ts', 'c.ts'], notified: true }, { threshold: 3 }).notify === false);
ck('custom threshold respected', evaluateDrift({ code: ['a.ts'] }, { threshold: 1 }).notify === true);
ck('garbage state -> no crash', evaluateDrift(null, { threshold: 3 }).notify === false);

// the bug the old test missed: a doc touch must RE-ARM the next wave
{
  let st = { code: ['a.ts', 'b.ts', 'c.ts'], notified: true };  // already warned
  st = recordEdit(st, 'README.md');                              // doc -> reset
  ck('doc clears notified + code', st.notified === false && st.code.length === 0);
  st = recordEdit(st, 'x.ts'); st = recordEdit(st, 'y.ts'); st = recordEdit(st, 'z.ts');
  ck('re-arms: new wave notifies again', evaluateDrift(st, { threshold: 3 }).notify === true);
}

// statePath is keyed per-session
{
  const a = statePath({ transcript_path: '/p/proj/aaa.jsonl', session_id: 'aaa' });
  const b = statePath({ transcript_path: '/p/proj/bbb.jsonl', session_id: 'bbb' });
  ck('statePath per-session differs', a !== b && a.includes('aaa') && b.includes('bbb'));
  ck('statePath falls back to transcript basename', statePath({ transcript_path: '/p/proj/zzz.jsonl' }).includes('zzz'));
  ck('statePath survives no input', typeof statePath({}) === 'string');
}

// editedFiles parses Edit/Write/MultiEdit payloads
ck('editedFiles Edit/Write top-level', editedFiles({ file_path: 'a.ts' }).length === 1);
ck('editedFiles MultiEdit edits[]', editedFiles({ edits: [{ file_path: 'a.ts' }, { file_path: 'b.ts' }] }).length === 2);
ck('editedFiles both shapes', editedFiles({ file_path: 'a.ts', edits: [{ file_path: 'b.ts' }] }).length === 2);
ck('editedFiles empty/garbage', editedFiles({}).length === 0 && editedFiles(null).length === 0);

console.log(`\n${pass}/${pass + fail} scenarios passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
