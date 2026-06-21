# Model-tier sweep — PRE-REGISTRATION (results pending)

> **RESULTS PENDING — the sweep has not been run.** This file pre-registers the
> design and the outcomes *before* any data exists, so the result can't be
> rationalised after the fact (METHODOLOGY's "pre-register before you look"). The
> tooling (`scripts/bench-sweep.js`, the per-model split in `scripts/bench-report.js`,
> the two harder fixtures) is built and unit-checked in `npm test`; the run itself
> makes hundreds of paid model calls and must happen on a machine with the `claude`
> CLI. **No measured claim ships until the rows are in `runs.jsonl`.**

## Why this experiment

The 2026-06-19 A/B ran on **Opus 4.8 only** — the strongest model, the *worst* case
for showing the discipline's value (it's already lean: 25/25 correct, 3.9 vs 3.6 vs
19.2 LOC, a tie between the disciplined arms). `benchmarks/README.md` and the A/B note
both predicted, in writing, that the effect should be larger on weaker models. This
sweep tests that directly across three tiers.

It also reconciles the framing other tools in this space use: a sibling project
([Ponytail](https://github.com/DietrichGebert/ponytail)) reports ~54% less code on
its **Haiku 4.5** agentic benchmark (vs an un-nudged agent) and an edge over a
one-line "YAGNI" arm — measured on a weak model. whippet found a *tie* vs the one-line
baseline on Opus. Both can be true if the discipline's edge over a one-liner shrinks as
the model strengthens. This sweep measures that curve with whippet's stricter method
(the one-line `baseline` arm always present, correctness as a hard gate, private
fixtures, Wilson CIs).

## Matrix

| | |
|---|---|
| **Models** | `claude-haiku-4-5` · `claude-sonnet-4-6` · `claude-opus-4-8` |
| **Arms** | `off` / `baseline` / `whippet` — prefixes **byte-identical** to `2026-06-19-opus-ab.md:13-15` (the only varied factor is the model) |
| **Fixtures** | the 5 existing + 2 harder: `overcut-parse-2` (trap_overcut, bidirectional grader), `batch-refactor` (batch_size, behaviour-only grader) |
| **Runs/cell** | 8 |
| **New generations** | Haiku 7×3×8 + Sonnet 7×3×8 + Opus(new fixtures only) 2×3×8 = **384** (Opus reuses its 75 existing rows for the 5 public fixtures) |

`node scripts/bench-sweep.js selftest` asserts this matrix offline (48 cells, 384 runs).

## Pre-registered metrics

Correctness (hard gate), `loc_added`, `files_added`, `deps_added`, reported **per
model × arm** and **per category** (no pooled-only number — Simpson's paradox).
`scripts/bench-report.js` emits the model×arm tables automatically once `runs.jsonl`
contains more than one model.

## Pre-committed outcomes (decide the reading now, not after)

- **Haiku edge** (most likely): on Haiku, `off`/`baseline` bloat more (higher LOC,
  `files_added` > 0 on `batch-refactor`) and/or crack on correctness (`overcut-parse-2`
  off-arm < 8/8), while `whippet` stays lean + correct, with the `baseline→whippet` gap
  visibly larger than on Opus → whippet's **first measured edge over the one-line
  baseline**, scoped to cheaper models, with CIs, no extrapolation.
- **Sonnet crossover**: an edge at Sonnet, smaller than Haiku, gone at Opus →
  "benefit scales inversely with model strength", the per-model table as evidence.
- **Null everywhere** (`whippet` ties `baseline` at every tier, `off` still bloats):
  honest negative — "any one-line discipline suffices across tiers; the elaboration buys
  no measured edge over the baseline." This **strengthens** the current README (it closes
  the "you only tested the strongest model" objection) rather than weakening it.
- **`off` ceilings too on Haiku** (dull null): "these tasks are too easy to separate any
  2026-tier model" → the boundary claim, with the harder-fixture numbers carrying the weight.

In every case: report per-model **and** per-category, show all runs, and name what was
NOT measured (real token cost, multi-turn / tool-use sessions, maintainability).

## Risks

Correctness ceiling even on Haiku (the two harder fixtures exist precisely to bite);
fixture contamination (the 2 new fixtures stay private/gitignored — weak models memorise
common patterns, so privacy matters *more* here); cost (de-scope a tier or fixture, never
the `baseline` arm, never mid-fixture); model-id drift (verify `--model` at run time);
temperature-0 non-determinism (n=8 mitigates, doesn't remove).
