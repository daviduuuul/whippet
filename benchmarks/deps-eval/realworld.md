# deps-audit — real-world validation (24 public repos)

The `corpus.json` eval uses *realistic synthetic* cases. This pass runs deps-audit against the
**actual root `package.json`** of 24 well-known public repos (fetched live from GitHub) to check
the false-positive rate on real declared dependencies — the strongest evidence available.

**Repos:** express, axios, chalk, got, pino, fastify, eslint, prettier, date-fns, gulp, nest,
vue/core, svelte, rollup, mocha, socket.io, webpack, astro, lodash, moment, next.js, vite, jest,
react-router. All 24 fetched and audited.

**Raw result:** 12 `native` + 10 `duplicate` findings. Classifying them against each repo's real
`engines.node` exposed **2 systematic false-positive patterns** — now fixed:

## FP 1 — bundlers were treated as competitors, but they compose

The `bundler` duplicate group (`webpack, rollup, esbuild, parcel, vite`) fired on **vue, rollup,
mocha, vite** — but `vite` is *built on* `rollup` + `esbuild`, so listing them together is normal,
not a "pick one." Modern build tools compose; the group can't tell composition from competition.
**Fix:** removed the `bundler` group entirely. The other duplicate groups (date, http client, test
runner, validation, logger) are real "pick one" sets where members don't compose, and stay.

## FP 2 — recent native swaps fired on repos with an unknown Node floor

`axios` declares `minimist` (→ `util.parseArgs`, Node 20) with **no `engines.node`**. The audit
flagged it with a "verify your Node" note — but axios targets old Node where `parseArgs` doesn't
exist, so the advisory is misleading. **Fix:** when the engine floor is unknown, only suggest
natives stable since **Node ≤ 18** (universally safe — `rimraf`/`structuredClone`/`AbortController`/
`randomUUID`/`Promise`/…). A recent swap (`parseArgs` 20, `withResolvers` 22, global `fetch` 21)
is suppressed rather than guessed at. Low-floor swaps on unknown engines still surface with the
verify note.

## Everything else was correct

The other 11 native findings are true positives on repos whose floor confirms the native
(`got`→`fetch` on Node 22, `next`→`AbortController` on Node 20, `vue`/`mocha`/`jest`→`rimraf`,
`fastify`→`rfdc`, `nest`→`uuid` with the v4 caveat, …). The remaining 6 duplicate findings are
`info`-level and land only on *library* repos that keep competitors as devDeps for benchmarking
(`got` vs axios/request, `pino` vs winston/bunyan, `fastify`'s validation libs) — an acceptable
edge case at info severity, not a false positive on a normal app.

**After the fixes**, re-running the two offending shapes (`minimist` with no engines; `rollup +
esbuild + vite`) yields **0 findings**. Locked in by tests `N3`/`N3b` (unknown-engine floor) and
`D5` (compositional bundlers). Reproduce the sweep with the `deps-audit-realworld` workflow.
