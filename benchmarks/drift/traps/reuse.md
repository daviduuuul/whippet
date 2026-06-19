<!-- researcher-only — do NOT paste this comment into the subject session.
fixture: reuse-slugify · category: trap_reuse
lean tell: calls the existing slugify() in src/utils.js (reused=true), no new dep, ~3 LOC.
bloat baited: re-implements slugify inline, or adds a slug dependency.
setup: copy benchmarks/fixtures/reuse-slugify/before/* into the subject repo first. -->

We need a title→URL helper. In `src/api.js`, export a `titleToSlug(title)` that
returns a URL-safe slug: lowercase, words joined by single hyphens, no leading or
trailing hyphen. So `"Hello, World!"` → `"hello-world"`. There's already some
string stuff in `src/utils.js` — wire it up however's cleanest.
