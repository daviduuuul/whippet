# Beating the baseline — edge hypotheses for whippet

Working notes (owner + Claude). **The question:** where can whippet show a
*measurable* edge — concrete data, not a tie — and over *which* rival? Every
hypothesis below ships with its null-risk stated up front (benchmarks are law:
we publish the null too).

## The three rivals — be precise about what we're beating

- **`off`** — no discipline at all.
- **`baseline`** — a one-line "be lean / YAGNI" nudge in the same channel.
- **`md`** — the full discipline pasted into `CLAUDE.md` (re-injected verbatim
  after compaction, for free, because it's memory not transcript).

## What we already know (2026-06-21 sweep, n=459, 3 tiers)

- whippet ≈ baseline on output size **and** correctness, every tier. `off`
  writes more, gap **largest on opus** (19.2 vs ~7.6 LOC), shrinks on weak models.
- One measured *cost*: whippet over-cuts slightly on `trap_overcut` (38/45 vs 41/45).
- **Therefore:** on "text-discipline sitting in the context window", whippet
  **cannot** beat `md` — same mechanism, same result. Stop running diff-size A/Bs
  expecting an edge; the edge (if any) is on a **different axis**.

## Guiding principle

whippet beats `md` **only where `md` is structurally blind**. `md` is: static
text, injected once, advisory-only, per-repo, hand-maintained. So compete on
*timing*, *specificity*, *enforcement*, and *user-cost* — never on diff size.

A hypothesis earns a run only if it predicts a gap `md` **cannot** close by
construction. If `md` could match it by editing the file, it's a tie waiting to happen.

---

## Hypotheses

Format — **claim · metric · arms · prediction · null-risk · feasibility**.

### H1 — Enforcement: the gate blocks, the text only asks  ⭐ strongest
- **Claim:** `whippet check` is an exit-coded, no-LLM gate; `md` is advisory an
  agent can ignore. The edge is *categorical* and *model-independent*.
- **Metric:** of N commits each carrying a deterministic problem (bare `// whippet:`
  marker, a new unjustified dep, an over-budget diff), what fraction reaches a
  commit? 
- **Arms:** `md` (rule in CLAUDE.md, agent self-polices) vs `whippet check` in
  pre-commit/CI (exit 2).
- **Prediction:** `md` lets through a non-zero fraction (the model sometimes
  ignores the advisory); `whippet check` lets through **0**. A clean, non-statistical gap.
- **Null-risk:** LOW. The gate's behavior is deterministic; the only question is
  how often `md` actually leaks (if it's ~0% too, the framing becomes "guarantee
  vs luck" — still a real distinction, just less dramatic).
- **Feasibility:** HIGH. Mostly scriptable: generate N flawed diffs, run each arm.
  The `md` arm needs a model in the loop; the gate arm doesn't.

### H2 — Deterministic specificity: the advisory names *your repo's* fact
- **Claim:** `md` can say "native before a library"; it can't read *your*
  `package.json` and say "drop `uuid`, you're on Node 22, use `crypto.randomUUID`".
  The deps advisory fires that exact fact the moment you touch `package.json`.
- **Metric:** in a project with a real redundant dep + a task that would use it,
  does the agent reach for the native API / propose removing the dep?
- **Arms:** `md` (generic rule) vs `whippet` (advisory naming the specific swap).
- **Prediction:** whippet > md, because a named fact is more actionable than a rule.
- **Null-risk:** MEDIUM–HIGH on strong models — opus already knows uuid→randomUUID
  from the generic rule. Edge most likely on **weak models** or **non-obvious deps**.
- **Feasibility:** MEDIUM. Needs fixtures with planted redundant deps; model in loop.

### H3 — Reactivity to state that changes *mid-session*
- **Claim:** `md` is injected once and never re-reads the repo. If a redundant dep
  is introduced *after* the session starts, `md` never notices; the `PostToolUse`
  advisory fires on the edit event.
- **Metric:** multi-step task that *adds* a redundant dep partway through. Does it
  survive to the end?
- **Arms:** `md` vs `whippet` (event-driven advisory).
- **Prediction:** whippet catches the late dep; `md` (static) misses it.
- **Null-risk:** MEDIUM — a strong model might self-audit at the end anyway.
- **Feasibility:** MEDIUM. Needs a scripted multi-turn task; model in loop.

### H4 — Resistance to context decay on long sessions  ⭐ promising
- **Claim:** `md` lives at the *top* of the context; over a long session it gets
  buried (lost-in-the-middle). whippet re-injects a compact reminder every
  `UserPromptSubmit` (mode-tracker), keeping the instruction *adjacent* to the
  generation point. This is the one quality axis where re-inject plausibly beats a
  static anchor — and `md` cannot self-reposition.
- **Metric:** lean-compliance on a task issued at turn N of a long, noisy session
  (N large), as a function of N.
- **Arms:** `md` (top-only) vs `whippet` (top + per-turn reminder), identical content.
- **Prediction:** equal at small N; whippet pulls ahead as N grows and the top anchor decays.
- **Null-risk:** MEDIUM. Modern long-context models may not decay much at our N;
  and post-compaction `md` *is* re-injected (so the gap only exists *between*
  compactions). Measure the no-compaction long-run window specifically.
- **Feasibility:** LOW (headless): needs real long sessions; not a cheap `claude -p` loop.
  This is the honest sibling of the drift-test — same "needs a real session" caveat.

### H5 — Token efficiency at equal compliance
- **Claim:** `md` pays the *full* discipline's tokens every turn (it's always in
  context); whippet pays the full anchor once (SessionStart) + a **compact**
  reminder per turn. Same effect, fewer discipline-tokens/turn.
- **Metric:** discipline-attributable context tokens per turn, at matched compliance.
- **Arms:** `md` (full text resident) vs `whippet` (anchor once + short reminder).
- **Prediction:** whippet uses fewer tokens/turn for the same compliance.
- **Null-risk:** LOW that the token math holds; LOW *value* — it's a small, technical
  edge, and `md` could be shortened by hand to match.
- **Feasibility:** HIGH. Pure accounting; measurable without model variance.

### H6 — Install-once & anti-drift (user-cost, not output quality)
- **Claim:** `md` is per-repo and hand-copied; across K repos it must be K-times
  installed and it *drifts* (copies diverge, get edited, go stale). whippet is one
  versioned, tested source.
- **Metric (a):** setup steps to enable the discipline in K projects. **(b):** in a
  real corpus of repos carrying a pasted discipline, how many copies have diverged
  / contain an error vs the single whippet source.
- **Arms:** `md`-per-repo vs `whippet`-installed.
- **Prediction:** whippet wins on both — categorically on (a), empirically on (b).
- **Null-risk:** LOW, but it measures **operational cost**, not model output — a
  different (still legitimate) kind of "fact".
- **Feasibility:** HIGH for (a); MEDIUM for (b) (need a corpus).

### H7 — Bigger / multi-file tasks: bloat accumulates
- **Claim:** the current fixtures are tiny single-shot tasks where everyone ties.
  The discipline may bite on large/multi-file work where un-nudged bloat compounds.
- **Metric:** off→disciplined LOC gap as a function of task size.
- **Arms:** off / baseline / whippet on graded-size fixtures.
- **Prediction:** the gap grows with task size (we already see a hint: `off` 19.2
  on opus came largely from the harder fixtures).
- **Null-risk:** MEDIUM. This likely separates **off vs disciplined**, not
  **whippet vs baseline/md** — so it strengthens "discipline matters" but probably
  still ties whippet to its disciplined rivals.
- **Feasibility:** MEDIUM. Bigger fixtures = more tokens/run; model in loop.

### H8 — Agentic multi-turn: replicate Ponytail's terrain + a baseline arm
- **Claim:** Ponytail's ~54% figure is on a *multi-turn agentic* benchmark vs an
  un-nudged agent — a different terrain from our single-shot A/B. Replicate it, but
  add the one-line `baseline` arm Ponytail lacks.
- **Metric:** code volume / scope-creep over a multi-turn agentic task.
- **Arms:** off / baseline / whippet (and `md`) on an agentic harness.
- **Prediction:** off >> disciplined (reproduces Ponytail's headline); whippet ≈
  baseline ≈ md (confirms the ~54% is off-vs-discipline, not whippet's own edge).
- **Null-risk:** the *point* is to attribute Ponytail's number honestly; "whippet
  ties baseline again" is the expected, useful result, not a failure.
- **Feasibility:** LOW–MEDIUM. Needs an agentic loop harness; costlier.

### H9 — Real dependency leanness, end-to-end (not the LOC proxy)
- **Claim:** LOC is a weak proxy. Measure the thing the deps engine is *for*: how
  many avoidable dependencies the agent ends a task with.
- **Metric:** count of redundant/duplicate/unused deps in the final `package.json`.
- **Arms:** off / baseline / whippet (advisory) / md.
- **Prediction:** whippet lowest (the advisory names them); baseline/md middle; off highest.
- **Null-risk:** MEDIUM — strong models add few deps regardless.
- **Feasibility:** MEDIUM. Reuses the deps engine as the grader; model in loop.

---

## Methodology guards (apply to every run)

- **Power first.** With n=8/cell, what effect size can we even detect? If the real
  effect is <1 LOC, no feasible N finds it — say so and don't burn quota chasing it.
- **Correctness stays a hard gate.** A "leaner" arm that breaks the task loses.
- **Private fixtures stay private** (gitignored); `runs.jsonl` carries only scored
  metrics, never fixture contents.
- **Pre-register the reading** before looking (which outcome means what), per the
  existing METHODOLOGY.
- **No new whippet features for a benchmark.** These all test *existing* capability
  (the gate, the advisories, the per-turn reminder) — only new fixtures/harness.

## Ranking — where to spend next

1. **H1 (enforcement)** — categorical, model-independent, cheap. The strongest and
   most honest "beats md": guarantee vs persuasion.
2. **H4 (context decay)** — the one *output-quality* axis where whippet's re-inject
   can plausibly beat a static anchor `md` can't reposition. Needs a real long session.
3. **H6 (install-once / anti-drift)** — easy, concrete, but it's operational cost,
   not model output. Good supporting fact, not the headline.
4. **H9 / H3 / H2** — clean use-cases for the hooks; medium null-risk on strong models.
5. **H7 / H8** — likely re-confirm "off bloats, disciplined arms tie"; run to attribute
   Ponytail honestly, not expecting a whippet-vs-baseline edge.
6. **H5** — true but low-value; fold into another run rather than spend a campaign on it.

## Parking lot (add ideas here)

- _(open — drop new hypotheses below as they come up)_
