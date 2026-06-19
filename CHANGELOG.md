# Changelog

All notable changes to this plugin. Versions follow the `vX.Y.Z` git tags.

## [Unreleased]

### Changed
- **Deflated the benchmark apparatus to what actually ran** (second review).
  Deleted the McNemar/Wilcoxon claim from `METHODOLOGY.md` — never implemented,
  and degenerate on a 25/25 ceiling (zero discordant pairs). Cut the unrun
  LLM-judge rubric to a one-line "not run, no claim". Removed every unpopulated
  column from `bench-report.js` (no scoreboard skeleton for a study not done).
  Dropped the "Benchmarked A/B" badge — the A/B showed a tie, not a validation.
  Cut `SKILL.md` 207→118 lines: the ladder isn't re-specified three times. The
  lesson, now a methodology guardrail: a false claim in one file isn't sanctioned
  by a confession in another — delete it.
- **Applied whippet to whippet, after an adversarial review.** Cut the per-turn
  reminder: the discipline now re-anchors at `SessionStart` (which fires on
  `compact`) and on an explicit mode change, not on every turn — removing an
  ~80-token-per-turn tax that whippet's own rung 1 says to cut. Aligned the
  SKILL's ultra-mode claim to the code (mode flips on `/whippet <level>` or
  `whippet <level>`, not on bare prose like "ultra mode"; selftest locks it).
  Trimmed the SKILL's opening flourish. README: dropped the misattributed "5×"
  hero number — it's the one-line baseline's result too, so crediting whippet
  with it was self-report by attribution. The honest pitch is now packaging
  (install-once portability, mode control, the commands), not a measured artifact
  or drift edge; the [A/B note](benchmarks/results/2026-06-19-opus-ab.md) carries
  the full verdict and the drift-test protocol.
- Reworded the skill, the injected hook text, and the README so the ladder, the
  guards, the "runnable check" rule, and the level table are whippet's own words,
  not Ponytail's — credit stays, borrowed phrasing doesn't.
- Reporting is now terse *by construction*: the discipline ships the mechanical
  levers (cut-word list, lead-with-result, keep-code-verbatim, a Not/Yes example)
  instead of only describing terseness — so `full` actually reads differently.
- Added an anti-*under*-building guard (YAGNI targets speculation, not a justified
  seam) and positioned whippet against Anthropic's official anti-over-engineering
  guidance.

### Added
- `/whippet-simplify`: the apply half of `/whippet-review`. Runs the same lean
  lens (dead code, reinvented logic, redundant deps, premature abstraction) and
  applies the behavior-preserving cuts — language-agnostic, mode-aware — while
  refusing to simplify away validation, security, or the runnable check. Leaves
  the tree clean and a check passing; risky cuts are flagged, not applied.
- Release tooling: `npm run bump <version>` keeps the version in sync across
  `package.json`, both manifests, and the README badge; `scripts/check-manifests.js`
  fails the build (via `npm test`) on any desync or a hooks.json pointing at a
  missing file.
- Benchmark harness v2 ([`benchmarks/METHODOLOGY.md`](benchmarks/METHODOLOGY.md)):
  three paired arms (off / one-line baseline / whippet), real fixture repos with
  hidden graders under `benchmarks/fixtures/`, an objective scorer
  (`scripts/bench-score.js`: correctness gate + LOC/deps/reuse), and an aggregator
  (`npm run bench`) with Wilson confidence intervals and per-category splits.
- Three trap fixtures (`reuse-slugify`, `stdlib-uuid`, `yagni-config`) and an
  LLM-judge (`scripts/judge.js`) for the qualitative metrics — rubric-based,
  reference-guided, position-bias-controlled (judge swapped, a win counts only
  both ways), model-agnostic. Its resolver ships a runnable check in `npm test`.
- Repo dev hook: edits to the hooks, scripts, or a manifest auto-run the suite
  and report a failure back (whippet dogfooding its own "always-on check").

## [1.2.1] — terser default reporting

- Report in the fewest lines that answer (often one).

## [1.2.0] — honest benchmarks + selftest

- Honest A/B benchmark screen; hooks selftest; README re-pitched to the real value.

## [1.1.0] — always-on

- SessionStart + UserPromptSubmit hooks keep the discipline on across the session
  and through compaction.

## [1.0.0] — initial release

- The `whippet` skill (YAGNI ladder, dependency hygiene, leave-a-check, terse
  reporting) plus `/whippet-review` and `/whippet-ledger`.
