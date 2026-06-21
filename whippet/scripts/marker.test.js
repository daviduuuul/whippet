'use strict';
// Runnable check for marker.js — the deterministic whippet: marker parser.
const { parseMarker, scanMarkers } = require('./marker.js');

let pass = 0, fail = 0;
const fails = [];
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; fails.push(name); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};
const ck = (name, cond) => {
  if (cond) pass++; else { fail++; fails.push(name); }
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

eq('free-form -> bare', parseMarker('// whippet: drop cache'), { shortcut: 'drop cache', until: null, bare: true });
eq('tracked with until', parseMarker('// whippet: drop cache | until: >1k entries'), { shortcut: 'drop cache', until: '>1k entries', bare: false });
eq('hash comment tracked', parseMarker('# whippet: skip retry | until: prod'), { shortcut: 'skip retry', until: 'prod', bare: false });
eq('sql -- comment tracked', parseMarker('-- whippet: inline sql | until: we add an ORM'), { shortcut: 'inline sql', until: 'we add an ORM', bare: false });
eq('block comment, closer stripped', parseMarker('/* whippet: stub | until: real API ships */'), { shortcut: 'stub', until: 'real API ships', bare: false });
eq('html comment, closer stripped', parseMarker('<!-- whippet: placeholder copy -->'), { shortcut: 'placeholder copy', until: null, bare: true });
eq('lisp ; comment bare', parseMarker(';; whippet: lisp corner'), { shortcut: 'lisp corner', until: null, bare: true });
eq('indented // marker', parseMarker('    // whippet: indented | until: later'), { shortcut: 'indented', until: 'later', bare: false });
eq('trailing inline comment', parseMarker('const x = 1 // whippet: magic number | until: configurable'), { shortcut: 'magic number', until: 'configurable', bare: false });
eq('empty body -> bare', parseMarker('// whippet:   '), { shortcut: '', until: null, bare: true });
eq('empty until -> bare', parseMarker('// whippet: x | until:   '), { shortcut: 'x', until: null, bare: true });
eq('case + spacing normalized', parseMarker('//   WHIPPET:  foo  |  UNTIL:  bar'), { shortcut: 'foo', until: 'bar', bare: false });
eq('pipe in shortcut without until stays bare', parseMarker('// whippet: a | b'), { shortcut: 'a | b', until: null, bare: true });
ck('no marker -> null', parseMarker('const s = "no marker here"') === null);
ck('word-boundary: notwhippet: -> null', parseMarker('const notwhippet: 1') === null);
ck('non-string -> null', parseMarker(42) === null && parseMarker(null) === null && parseMarker(undefined) === null);

{ // scanMarkers: line numbers + classification across a file
  const hits = scanMarkers('line one\n// whippet: one\ncode here\n# whippet: two | until: v2\nlast');
  ck('scan finds 2 markers', hits.length === 2);
  ck('scan 1-based line numbers', hits[0].line === 2 && hits[1].line === 4);
  ck('scan classifies bare/tracked', hits[0].bare === true && hits[1].bare === false);
  ck('scan keeps raw + fields', hits[1].shortcut === 'two' && hits[1].until === 'v2');
}

console.log(`\n${pass}/${pass + fail} marker checks passed`);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
process.exit(0);
