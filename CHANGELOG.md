# Changelog

All notable changes to this plugin. Versions follow the `vX.Y.Z` git tags.

## [Unreleased]

### Changed
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
- Release tooling: `npm run bump <version>` keeps the version in sync across
  `package.json`, both manifests, and the README badge; `scripts/check-manifests.js`
  fails the build (via `npm test`) on any desync or a hooks.json pointing at a
  missing file.
- Benchmark harness v2 ([`benchmarks/METHODOLOGY.md`](benchmarks/METHODOLOGY.md)):
  three paired arms (off / one-line baseline / whippet), real fixture repos with
  hidden graders under `benchmarks/fixtures/`, an objective scorer
  (`scripts/bench-score.js`: correctness gate + LOC/deps/reuse), and an aggregator
  (`npm run bench`) with Wilson confidence intervals and per-category splits.
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
