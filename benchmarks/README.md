# Benchmarks

Most tools in this space lead with a big number: "−80% code", "−75% tokens".
Independent re-tests keep finding those numbers measure the wrong thing
([Ponytail #121](https://github.com/DietrichGebert/ponytail/issues/121),
[npow](http://npow.github.io/posts/does-caveman-mode-actually-work/),
[implicator.ai](https://www.implicator.ai/caveman-claude-code-skill-cuts-output-20-your-bill-barely-notices-2/)).
So whippet does the opposite: it reports where it helps **and where it doesn't**.

Two tiers:

- **Tier 0 — directional screen (below):** a quick hand-scored A/B. Cheap, honest
  about being weak (single run, self-reported). Good for a gut check, not proof.
- **Tier 2 — the real harness:** three paired arms, real fixture repos with hidden
  graders, automated objective metrics, and confidence intervals. The protocol is
  in [METHODOLOGY.md](METHODOLOGY.md); fixtures live in [`fixtures/`](fixtures/),
  scored by `scripts/bench-score.js` and aggregated by `npm run bench`.

## Tier 0 method

For each task, the same prompt is sent to two agents: one following whippet, one
not (`stop whippet`). We don't grade lines saved. We grade what actually matters:

- Did it add a dependency something installed or the platform already covers?
- Did it reuse an existing/native solution?
- Did it leave a runnable check on non-trivial logic?
- Did it preserve validation and security, or cut them to look smaller?
- Did it over-engineer (premature abstraction, extra files)?

Tasks: 10 small ones (date formatting, deep clone, dedupe, debounce, env config,
unique id, fetch-with-retry, lazy image, validate with an already-installed
`zod`, password hashing) and 3 multi-file ones (Express signup/login, a React
orders table with filters, a JSON-merge script).

## Results (Claude Opus 4.8, single run per cell)

**On code size and dependencies, whippet barely moved the needle — and we will
not pretend otherwise.** Across all 13 tasks, *neither* arm added an unnecessary
library. A modern frontier model already reaches for `Intl`, `structuredClone`,
`Set`, `crypto.randomUUID`, `<img loading="lazy">`, a plain retry loop, and
reuses the installed `zod`. If your pitch is "it stops the AI from pulling in
lodash", a 2026 model mostly already does that on its own.

**Where whippet measurably changed the outcome — the discipline layer:**

| Signal | With whippet | Baseline |
|---|---|---|
| Runnable check left behind (3 multi-file tasks) | **3 / 3** | 0 / 3 |
| Trust-boundary validation added where it was missing | yes (env, auth) | no |
| Dependencies on the auth task | bcrypt only (stdlib token) | bcrypt **+ jsonwebtoken** |
| Password hashing | vetted library (not hand-rolled) | vetted library |

The baseline repeatedly wrote an ad-hoc test, ran it, and deleted it. Whippet
leaves the check in the code. That, not code size, is the repeatable difference.

## Honest caveats

- One run per cell. Small sample. Self-reported manifests, not a static analyzer.
- One model (Opus 4.8). Smaller or older models over-engineer more, so the
  dependency/size effect would likely be larger there — untested here.
- whippet was registered in the session, which may have nudged the baseline
  toward leaner choices. If anything, that *understates* the real gap.

This is a directional screen, not a statistical proof. We would rather ship a
small honest screen than a big dishonest headline.

## Run Tier 2 (the real harness)

Per fixture, run all three arms (`off`, `baseline`, `whippet` — see
[METHODOLOGY.md](METHODOLOGY.md)) in a fresh copy of the fixture's `before/`,
then score each result against the fixture:

```
node scripts/bench-score.js <fixture-id> <arm> <candidate-dir> --model <model> --save
npm run bench   # aggregate every results/*.json{,l} into one scoreboard
```

The scorer runs the hidden grader (correctness gate), then measures LOC/files/
dependencies added and whether the existing helper was reused — appending one row
to `results/runs.jsonl`. `bench-score.js` against a fixture's `reference/` is the
harness's own runnable check (it should score `correct: true`).

Where to push for **big** results: add fixtures (especially traps) and run the
smaller/older models too. A frontier 2026 model is already lean, so the
size/dependency axis barely moves — the gap is predicted to widen on weaker
models, and the harness is built to surface exactly that, with CIs that stay
honest about small samples.
