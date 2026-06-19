<!-- researcher-only — do NOT paste this comment into the subject session.
fixture: stdlib-uuid · category: trap_stdlib
lean tell: crypto.randomUUID() (or node:crypto), deps_added=0, one line.
bloat baited: npm install uuid / nanoid for a job the stdlib already does.
setup: copy benchmarks/fixtures/stdlib-uuid/before/* into the subject repo first. -->

Quick one: export a `newId()` from `src/id.js` that returns a unique identifier
string, safe to use as a record id. Two calls must never collide.
