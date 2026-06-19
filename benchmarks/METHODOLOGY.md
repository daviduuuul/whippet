# Benchmark methodology

How whippet measures itself. **One real screen has run**
([verdict](results/2026-06-19-opus-ab.md)) and it found whippet **ties** a
one-line baseline on the artifact. What follows is the protocol and the limits,
not a finished study — read the verdict first for what the data actually supports.

## The one rule everything else serves

**Benchmark against the trivial baseline, on the metric the user actually cares
about — or you measure a real effect that means nothing.** Three independent
re-tests of the terse-output plugins converged on exactly this:

- A clean A/B found the two-word instruction *"Be brief."* matched an elaborate
  plugin on both compression and quality —
  [maxtaylor.me](https://www.maxtaylor.me/articles/i-benchmarked-caveman-against-two-words).
- A 540-call re-run caught a **Simpson's paradox**: the headline "savings"
  vanished once you split short vs. expensive tasks —
  [npow](https://npow.github.io/posts/does-caveman-mode-actually-work/).
- The advertised token cuts hit **0.6–2.5%** of real spend once you use the right
  denominator —
  [implicator.ai](https://www.implicator.ai/caveman-claude-code-skill-cuts-output-20-your-bill-barely-notices-2/).
- Manifest/“self-reported” numbers misrepresent actual behavior —
  [ponytail #121](https://github.com/DietrichGebert/ponytail/issues/121).

Our v1 screen (`README.md`) had the v1 flaws: single run per cell, self-reported,
no trivial baseline. This is how we fix that.

## Three arms, always paired

Every task runs all three on the **same seed**, so per-task difficulty cancels:

| Arm | What it is |
|---|---|
| **off** | Claude Code, whippet disabled (`stop whippet`). |
| **baseline** | A one-line nudge: *"Write the minimal code that works; reuse existing/stdlib/native before adding code or dependencies; report tersely."* |
| **whippet** | The full plugin. |

If whippet doesn't beat **baseline**, the elaboration isn't earning its keep —
and that's a finding worth publishing, not hiding.

## Tasks: real fixtures, not abstract prompts

Abstract prompts let the model invent context and let us grade leniently. Tier 2
uses small **real fixture repos** under [`fixtures/`](fixtures/): a starting repo
snapshot (`before/`), a task, a **hidden objective grader**, and a lean reference
solution. Each fixture targets a place bloat sneaks in, and several are **traps**:

- a needed dependency already exists in the repo — reuse it, or re-add it? (`trap_reuse`)
- the job is a stdlib one-liner — reach for a new dep, or not? (`trap_stdlib`)
- the right answer is *don't build it* (YAGNI). (`trap_yagni`)
- a real boundary needs a guard — keep the validation, or shave it to look lean? (`trap_overcut`)
- a multi-step change — one small focused diff, or a large multi-file batch? (`batch_size`)

The last two ground claims whippet already makes. `trap_overcut` makes the
correctness gate bite from both sides: its grader feeds untrusted input and fails
a candidate that dropped the guard to shrink the diff — so "can't be gamed by
deleting needed code" (below) is enforced, not just asserted. `batch_size` is the
[DORA](https://dora.dev/dora-report-2025/) small-batches lever: a multi-step task
where the lean path is a small diff; correctness stays the gate, and the batch
signal is *scored* (per-category `loc_added`/`files_added`, surfaced by
`bench-report.js` since the arm-wide means dilute it), never graded.

Keep fixtures **private/unpublished** — anything public leaks into training
([OpenAI retired SWE-bench Verified](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)
partly over contamination + flawed graders). Treat any public task as burned.

## What's automated vs. judged

**Automated, objective, per run** (`scripts/bench-score.js`):

- **Correctness** — the hidden grader passes. This is a **hard gate**: lean-ness
  only counts if the code is correct, so it can't be gamed by deleting needed code.
  Graders load the candidate whether it used ESM (`export`) or CommonJS
  (`module.exports`) — the module convention the task never specifies, so it isn't
  a scoring confound (`fixtures/_load.mjs`).
- **LOC added**, files added (proxy for size — never a target on its own; LOC is
  gameable, [Goodhart](https://getdx.com/blog/lines-of-code/)).
- **Dependencies added** — manifest diff. Fully objective.
- **Reuse** — did the candidate use the existing helper the fixture flags?

**Qualitative (over-engineering, reuse quality, terse-but-complete) — not run.**
A bias-controlled LLM-judge (`scripts/judge.js`, position-bias guarded,
cross-family) is written for it, but it has produced **zero** observations. Until
it runs, whippet makes **no** qualitative claim and the scoreboard shows no
qualitative column. The harness scores only the objective metrics above.

## Statistics — and their limits at this sample

- **≥5 runs per (task × arm)** — one run is a Bernoulli draw with no error bar;
  temperature 0 is **not** deterministic
  ([thinkingmachines](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)).
- `bench-report.js` reports a Wilson 95% CI per rate. Be blunt about what that
  buys here: with correctness at **25/25 for every arm**, the CIs only separate
  *off* from the rest — the one comparison that needed no study. **No paired
  significance test is claimed**; on a 25/25/25 ceiling McNemar is degenerate
  (zero discordant pairs). LOC is the only axis with spread.
- **Report per category**, never only the pooled number (Simpson's paradox).
- **Pre-register** metrics before looking; report **all** runs, never best-of;
  publish the nulls.

## Data schema

One observation per (run × task × arm), appended to `results/runs.jsonl` by the
scorer (or hand-authored into a `results/*.json` `observations` array):

```json
{ "task": "reuse-slugify", "category": "trap_reuse", "arm": "whippet",
  "model": "claude-opus-4-8", "correct": true, "loc_added": 6, "files_added": 0,
  "deps_added": 0, "reused": true }
```

`npm run bench` aggregates everything under `results/` into one scoreboard with
per-arm rates + CIs and a per-category breakdown. **Never self-report from a
manifest** — score observed behavior (the ponytail #121 lesson).

## Honesty guardrails

1. Always include the one-line **baseline** arm.
2. **Correctness is a hard gate.**
3. Keep fixtures private.
4. Report CIs, per-category splits, and all runs.
5. State plainly what we did **not** measure (real-bill cost, long-term
   maintainability). Credibility comes from naming our own limits.
6. **Never define a metric, a test, or a rubric the harness doesn't actually
   run.** A false claim in one file is not sanctioned by a confession in another —
   delete it. (This guardrail exists because this doc once asserted paired tests
   that weren't there.)
