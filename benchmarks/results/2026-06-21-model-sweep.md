# Model-tier sweep — pre-registration + results

> **RESULTS IN (2026-06-21).** The sweep ran: **459 observations**, 3 models × 3 arms ×
> 7 fixtures, n=8/cell. **Outcome: the null (pre-committed outcome #3 below) — and it
> *reverses* the lead hypothesis.** `whippet` ties the one-line `baseline` on every tier,
> on correctness and on diff size; the only robust effect — an un-nudged agent writing
> more code — is **largest on the strongest model (Opus), not the weakest.** Full tables
> in [Results](#results-2026-06-21). The pre-registration below is kept verbatim (written
> before any data existed, per METHODOLOGY's "pre-register before you look").

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

## Results (2026-06-21)

Run on 2026-06-21 with the `claude` CLI, n=8/cell, temperature 0. **459 observations** =
75 pre-existing Opus rows (5 public fixtures) + 384 new (Haiku 168, Sonnet 168, Opus 48
on the 2 new fixtures). Tables are `node scripts/bench-report.js` over the committed
`runs.jsonl` — re-run it to reproduce them.

**Outcome: the null (pre-committed outcome #3), with a twist that reverses the lead
hypothesis.** `whippet` does not beat the one-line `baseline` on any tier, on correctness
or on diff size — if anything it is a hair larger, so the discipline's extra prose buys no
measured win over a one-liner. The only robust effect is that the un-nudged `off` arm
writes more code, and that gap is **largest on the strongest model (Opus) and shrinks on
the weaker ones** — the opposite of the "cheaper models benefit more" prediction this
sweep set out to test.

### Correct by model × arm (Wilson 95% CI)

| Model | whippet | baseline | off |
|---|---|---|---|
| claude-opus-4-8 | 41/41 (91–100%) | 41/41 (91–100%) | 41/41 (91–100%) |
| claude-haiku-4-5 | 50/56 (79–95%) | 52/56 (83–97%) | 51/56 (81–96%) |
| claude-sonnet-4-6 | 55/56 (91–100%) | 56/56 (94–100%) | 56/56 (94–100%) |

No arm separates from another at any tier — every interval overlaps. `whippet` is
marginally the *lowest* on each tier (see the over-cut cost below).

### Diff size by model × arm (mean LOC added)

| Model | whippet | baseline | off |
|---|---|---|---|
| claude-opus-4-8 | 8.9 | 6.3 | 19.2 |
| claude-haiku-4-5 | 9.7 | 9.1 | 11.4 |
| claude-sonnet-4-6 | 5.8 | 5.6 | 6.6 |

The `off`→disciplined gap is ~2.5–3× on Opus, ~1.2× on Sonnet and Haiku. The bloat an
un-nudged agent produces is **biggest on the strongest model**, not the weakest, so a
leanness nudge pays off *most* on Opus here. `whippet` vs `baseline` is a wash on all
three (whippet a touch higher).

### By category (all models pooled — correct · mean LOC)

| Category | whippet | baseline | off |
|---|---|---|---|
| trap_reuse | 21/21 · 3.0 | 21/21 · 2.6 | 21/21 · 5.6 |
| trap_stdlib | 21/21 · 2.5 | 21/21 · 2.9 | 21/21 · 5.9 |
| trap_yagni | 21/21 · 1.8 | 21/21 · 1.8 | 21/21 · 7.2 |
| trap_overcut | 38/45 · 20.4 | 41/45 · 17.1 | 40/45 · 26.8 |
| batch_size | 45/45 · 3.5 | 45/45 · 3.5 | 45/45 · 4.5 |

`off` is correct as often as the disciplined arms even on the traps — 2026-tier models
don't *crack*, they just write more around the problem. The one place the discipline has
a measurable *cost* is **trap_overcut**: `whippet` 38/45 vs `baseline` 41/45 — its removal
bias occasionally cuts code that was load-bearing. `deps_added` was 0 in every cell;
`files_added` was 0 everywhere except a single `whippet` run on trap_overcut/Opus.

### What it means for whippet

The README positions whippet as a **convenience wrapper** — install-once portability,
mode control, the deterministic config/deps/marker checks — explicitly *not* a measured
"less code" or "beats the baseline" edge. This sweep **confirms** that across three model
tiers and **closes the standing objection** that the 2026-06-19 A/B "only tested the
strongest model": the one-line baseline ties whippet on Haiku and Sonnet too. The honest
cross-model finding now on the record, with CIs and per-category splits and no
extrapolation: *an un-nudged agent's bloat grows with model capability, and any one-line
nudge erases most of it.*

### Not measured

Real token/$ cost, multi-turn / tool-use sessions, output maintainability or readability,
and anything outside these 7 single-shot fixtures. The 2 hardest fixtures stay private
(gitignored) to avoid training-set contamination; `runs.jsonl` carries only the scored
metrics (model / arm / category + booleans / counts), never fixture contents.
