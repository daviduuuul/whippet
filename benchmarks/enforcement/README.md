# Enforcement experiment (H1) — does the gate beat advisory?

**Question.** whippet's discipline can run two ways: as advisory text in the context (a
`CLAUDE.md` paste) or as `whippet check`, an exit-coded gate. H1 asks whether the gate
actually stops a bad change that advisory text would let through.

**Setup.** 3 scenarios, each a staged change carrying a problem whippet detects: a bare
`// whippet:` marker (no `| until:`), a new unjustified dependency (`left-pad` on Node 22),
and an over-budget diff (~40 lines vs a 10-line budget).

- **gate arm** — `node benchmarks/enforcement/gate-run.js`: run `whippet check --strict` on
  each, record the exit code. Deterministic, no model, reproducible.
- **md arm** (proxy) — 5 independent agents per scenario, each carrying the discipline as
  advisory text, asked whether they'd commit the staged change as-is or fix it first.
  *Proxy caveat:* one-shot judgments, not a real session — directional, not a number to quote.

## Results

| scenario | gate (`--strict`) | md advisory (commit = leak) |
|---|---|---|
| bare `// whippet:` marker | blocked (exit 1) | 0/5 leak |
| new unjustified dependency | blocked (exit 1) | 0/5 leak |
| over-budget diff (~40 lines) | blocked (exit 1) | **4/5 leak** |
| **total** | **3/3 blocked — 0% leak** | **4/15 leak — 27%** |

## Reading (with the nuance the data forces)

1. **On objective rules — a bare marker, a redundant dependency — the advisory already
   holds** (0% leak; a strong 2026 model fixes them) **and the gate guarantees it.** The
   gate's edge here is *categorical certainty* (0% by construction, model-independent), even
   if the practical gap on a strong model is small.

2. **On the heuristic rule — diff size — the md "leak" is not a failure, it's judgment.**
   4/5 agents committed the 40-line diff, each arguing (correctly) that *a cohesive 40-line
   feature is a normal atomic commit, and splitting it to hit an arbitrary 10-line budget
   would make worse, non-atomic commits.* The gate only "wins" the leak count by being
   arbitrarily rigid.

3. **So enforcement pays where the rule is objective, not where it's a heuristic.** This is
   exactly why `whippet check` keeps the marker check an `error` but the diff budget a
   `warning` — it becomes an `error` only under `--strict` (opt-in, for CI). The experiment
   **validates that design**: hard-enforce the binary facts, advise on the judgment calls.

## Verdict for H1

The gate is the only version of the discipline with **mechanical enforcement** — a guarantee
advisory text cannot give. But the honest scope of that guarantee is the *objective* checks
(bare markers, redundant deps); on subjective ones (diff size) a gate is just a rigid opinion,
and whippet correctly leaves those advisory by default. "Put it in CI" is real value — for the
binary checks.

*Not measured:* a real multi-turn session. The md arm is a one-shot proxy; a true test needs a
live agent (like the drift test). The numbers are directional, not publishable claims.
