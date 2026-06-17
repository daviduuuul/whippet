# Benchmarks

Most tools in this space lead with a big number: "−80% code", "−75% tokens".
Independent re-tests keep finding those numbers measure the wrong thing
([Ponytail #121](https://github.com/DietrichGebert/ponytail/issues/121),
[npow](http://npow.github.io/posts/does-caveman-mode-actually-work/),
[implicator.ai](https://www.implicator.ai/caveman-claude-code-skill-cuts-output-20-your-bill-barely-notices-2/)).
So whippet does the opposite: a small, honest A/B screen that reports where it
helps **and where it doesn't**.

## Method

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

## Reproduce it yourself

Install whippet, then for any task above:

1. New session, run the task normally (whippet is on). Save the result.
2. New session, type `stop whippet`, run the same task. Save the result.
3. Compare on the five questions under **Method**.

No API keys, no harness. The agent is the harness.
