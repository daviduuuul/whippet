# Enforcement experiment (H1) — does the gate beat advisory?

**Question.** whippet's discipline can run two ways: as advisory text in the context (a
`CLAUDE.md` paste) or as `whippet check`, an exit-coded gate. H1 asks whether the gate
actually stops a bad change that advisory text would let through.

Two arms answer it from opposite ends:
- **gate arm** — deterministic, no model. Stage a flawed change, run `whippet check`, record
  the exit code. `node benchmarks/enforcement/gate-run.js`.
- **live arm** — real multi-turn agents do a normal coding task whose lean solution needs no
  dependency; the violation is *buried* (deps are never mentioned). Score the result with
  whippet's own gate. `node benchmarks/enforcement/live-run.js` (see below).

---

## Gate arm (deterministic)

3 staged problems: a bare `// whippet:` marker (no `| until:`), a new unjustified dependency
(`left-pad` on Node 22), an over-budget diff (~40 lines vs a 10-line budget).

| scenario | `whippet check --strict` |
|---|---|
| bare `// whippet:` marker | blocked (exit 1) |
| new unjustified dependency | blocked (exit 1) |
| over-budget diff (~40 lines) | blocked (exit 1) |
| **total** | **3/3 blocked — 0% leak, by construction** |

The gate's catch rate is a fact, not a measurement: it blocks anything its audits flag, with
no model and no variance.

## Live arm (real multi-turn agents)

The earlier write-up used a one-shot *proxy* ("would you commit this?"). That primed the agent
to look. The live arm replaces it: a genuine multi-turn session on a task whose lean answer is
a single native call, with the violation buried.

- **Scenarios (3, objective, buried):** `clone` (deep copy → `structuredClone`), `uuid` (v4 →
  `crypto.randomUUID`), `dotenv` (load `.env` → `process.loadEnvFile` / a 3-line parse). Each
  project declares `engines.node` high enough that deps-audit's native swap is active, so *any*
  dependency the agent adds is a leak the gate would block.
- **Arms:** `advisory` (whippet's exact discipline payload pasted as CLAUDE.md) vs `off`
  (the task alone, no discipline) — the control that isolates whether the *paste* does anything.
- **Models:** `claude-haiku-4-5`, `claude-sonnet-4-6`. **N = 5** per scenario × model × arm
  (60 runs). **Leak** = the run added any dependency or imported any non-builtin library.

| scenario | off (no discipline) | advisory (whippet md) |
|---|---|---|
| clone | 0/10 | 0/10 |
| uuid | 0/10 | 0/10 |
| dotenv | 0/10 | 0/10 |
| **total** | **0/30 — 0%** (95% CI 0–11%) | **0/30 — 0%** (95% CI 0–11%) |

**The experiment failed to induce a single leak.** Both models, with or without the discipline,
wrote the native solution every time — `structuredClone` / `JSON.parse(JSON.stringify())`,
`crypto.randomUUID()`, a hand-rolled `fs` parse of `.env`. Not one reached for `lodash`, `uuid`,
or `dotenv`, the canonical reflexes.

## Reading (what the null actually says)

1. **On objective native-equivalent tasks, a 2026 model doesn't leak — discipline or not.**
   `off` and `advisory` are indistinguishable (0% vs 0%). On *these* tasks the CLAUDE.md paste
   changes nothing because there is nothing to change: the model already picks native. This
   matches the A/B sweep's null (whippet ≈ the one-line baseline).

2. **So the live data cannot show the gate "catching what advisory missed" — nothing was
   missed.** The gate's 0% is real but *by construction*: it would block a leak if one occurred.
   Its value here is a **guarantee**, not an incremental catch on a strong model.

3. **Where that guarantee actually pays is exactly what this run did not exercise:** a weaker or
   older model, a regression, a contributor who never reads CLAUDE.md, or a lib outside the
   agent's reflexes. And the guarantee is only as wide as deps-audit's tables — the harness
   selftest shows the gate catches `rfdc`/`dotenv` but **misses** `lodash.clonedeep` (not in its
   tables). The gate is insurance with a known coverage limit.

## Verdict for H1

The gate is the only form of the discipline with **mechanical enforcement** — a model-independent
guarantee advisory text cannot give. But the honest, measured scope of that guarantee is narrow:
on the objective tasks a strong 2026 model handles correctly on its own, the gate's marginal value
over advisory is **unmeasurable (0 vs 0)** — it is insurance against a leak the model rarely
produces. "Put it in CI" is genuine value for regressions, weaker models, and outside
contributors; it is *not* a babysitter a capable agent needs on common native-equivalent work.

*Limits.* N=5/cell (wide CIs); two models; three native-equivalent scenarios chosen because the
gate's tables cover them. The result is an honest null — it bounds where the gate helps, it does
not prove it never helps. Reproduce: `node benchmarks/enforcement/live-run.js --selftest`, then
`--live --models claude-haiku-4-5,claude-sonnet-4-6 --reps 5` (needs `WHIPPET_SWEEP_YOLO=1`), or
`--seed`/`--score` around any agent. Raw rows in `live-results.jsonl`.
