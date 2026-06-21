# Changelog

All notable changes to this plugin. Versions follow the `vX.Y.Z` git tags.

## [Unreleased]

### Fixed
- **marker.js splits on every line-ending form.** `scanMarkers` split on `/\r?\n/`, so a
  file using lone-CR line endings (no LF) kept the `\r` embedded in each "line"; the marker
  regex (`.` doesn't match `\r`, `$` without `/m`) then matched nothing and every
  `// whippet:` marker went undetected. Now splits on `\r\n | \r | \n`, so markers are found
  whatever the line-ending style.

## [2.0.1] — 2026-06-21

### Performance
- **Merged the two PostToolUse hooks into one** (`whippet-posttooluse.js`). Every
  Edit/Write/MultiEdit fired two node spawns (drift-track + deps-check, ~50ms each on
  Windows); now one process does both jobs — ~50ms saved per edit, more on Windows.
  Behavior-preserving (same `WHIPPET_DRIFT_OFF`/`WHIPPET_DEPS_OFF` switches, per-session
  dedup, never-throws). Validated by plugin-dev:plugin-validator.

## [2.0.0] — 2026-06-21

### Changed (BREAKING)
- **Whippet is now autonomous — it mostly runs on its own.** Removed the four commands
  nobody reached for: `/whippet-review`, `/whippet-simplify`, `/whippet-ledger`,
  `/whippet-deps`. Their deterministic value moves into quiet, non-blocking hooks; the
  engines (`config-audit.js`, `deps-audit.js`, `marker.js`) are unchanged — only their
  packaging shifts from commands to hooks.
- `/whippet-config` is the **one** remaining command (the full, on-demand setup audit).
  `whippet check` stays as the opt-in pre-commit/CI gate — a script, not a slash command.
- The README is now **minimal by design**: current version + what the plugin does +
  install, nothing else.

### Added
- **Config advisory** (`SessionStart` startup → `whippet-config-check.js`) — runs the
  config audit once and surfaces a one-line advisory **only when there are errors**
  (warnings/info stay for `/whippet-config`, so it never nags). Off: `WHIPPET_CONFIG_OFF=1`.
- **Dependency advisory** (`PostToolUse` → `whippet-deps-check.js`) — when `package.json`
  changes, runs the deps audit and surfaces new native-equivalent / duplicate findings,
  deduped per session. Off: `WHIPPET_DEPS_OFF=1`.
- `sessionStatePath(kind)` factored into `whippet-drift-core.js` (`statePath` stays
  byte-compatible) + `whippet-deps-core.js`. 13-check `whippet-autonomy.test.js` (pure
  core + spawned integration), wired into `npm test`.

## [1.6.0] — 2026-06-21

### Added
- **`/whippet-deps`** — a deterministic dependency-leanness auditor, the third pillar
  beside `/whippet-config`. Flags a package the platform/stdlib already covers (curated
  1:1 allowlist, **engine-gated** so it never suggests a swap your Node floor is too old
  for), a declared-but-unused dependency (import-shaped scan + 5 escape hatches, `info`
  + *verify*), and duplicate-purpose libraries. Read-only, conservative (under-reports
  rather than cry wolf), 24 scenarios.
- **`whippet check`** — a deterministic pre-commit/CI gate (`whippet/scripts/check.js`),
  no LLM. Composes the deps audit + a bare-marker check + a staged-diff budget (and
  `/whippet-config`, opt-in), exits non-zero on a real finding **and on its own crash**
  (a gate that goes green from a bug is the worst failure). Scopes markers/budget to the
  staged diff or `--range <ref>`; `--strict`/`--json`. 11 scenarios on real temp git repos.
- **Structured `// whippet:` markers** — `| until: <condition>` names the ceiling, so
  `/whippet-ledger` and `/whippet-review` classify tracked-vs-bare **deterministically**
  (`whippet/scripts/marker.js`, the shared parser). Backward-compatible: free-form markers
  still parse as bare, and `git grep "whippet:"` still finds every one.
- **Model-tier benchmark sweep — tooling + pre-registration** (results pending). A
  per-model split in `bench-report.js` (gated on >1 model, so the single-model scoreboard
  is byte-identical until rows exist), a reproducible runner `scripts/bench-sweep.js`
  (offline `selftest` asserts the 48-cell / 384-run matrix), two harder private fixtures,
  and a pre-registered protocol ([`results/2026-06-21-model-sweep.md`](benchmarks/results/2026-06-21-model-sweep.md)).
  The Opus-only A/B is the leanest case; the sweep tests whether the discipline's edge over
  a one-liner grows on cheaper models. **No measured cross-model claim until it runs.**

### Changed
- `/whippet-config`: three new false-positive-safe checks — an invalid hook `timeout`
  (≤0 / non-integer; absent stays fine), a rule present in both `allow` and `deny` (deny
  wins, the allow is dead), an MCP server declaring both `command` and `url`. 96 scenarios.
- `/whippet-review` + `/whippet-simplify`: per-severity output + a `--json` mode, so a
  review can pipe into a gate.
- README / CLAUDE.md / plugin.json reframed around **four** tools + the gate. Honesty
  section now states the A/B measures size / dependencies / correctness only (the
  qualitative calls stay unmeasured) and that the one-liner tie is on the leanest model.

### Fixed
- `scripts/judge.js` is marked explicitly as un-run scaffolding (zero observations → no
  qualitative claim). `WHIPPET_DRIFT_THRESHOLD`'s default (3) is now self-documented in
  the hook.

## [1.5.3] — 2026-06-21

### Fixed
- **The runtime payload had silently drifted from `SKILL.md`.** The always-on anchor
  in `whippet-core.js` had dropped the `// whippet:` marker rule that `/whippet-ledger`
  exists to harvest — the command collected a marker the discipline never told the
  agent to plant — and left rung 4 ("native before a library") beside the security
  line with no carve-out (the one place getting the ladder wrong means hand-rolling
  crypto). Both restored, and `selftest.js` now asserts the load-bearing anchors stay
  in the payload, so it can't drift unnoticed again.
- **`/whippet-config` flagged a working relative hook/statusLine path as missing.** A
  relative script path was resolved against the process cwd, not the config dir, so a
  valid `"hooks/x.js"` read as broken — a false positive, the worst bug class for a
  config doctor. Now resolved against the config dir (accepted if it exists either way).

### Added
- **`/whippet-config` audits `settings.local.json` content, not just its JSON validity.**
  Its hooks, statusLine, permissions, enums, and plugin enablement override
  `settings.json` and are now checked with the same lens (local wins per key, matching
  Claude Code precedence) — the standard place per-machine drift accumulates. +8 scenarios.

### Changed
- **De-duped the review/simplify detection taxonomy.** The five shared categories were
  hand-maintained twice; `/whippet-review` now points to `/whippet-simplify`'s list for
  the shared lens and keeps only its review-only checks (marker-without-ceiling, missing
  check, oversized batch, over-cut). One source, no drift — the bloat whippet audits for.
- README: documented the commands' optional path/range argument, the drift hook's
  `WHIPPET_DRIFT_THRESHOLD` knob and its path-only limit, and the `settings.local.json`
  coverage — shipped-but-undisclosed behavior, now stated.

### Docs
- Backfilled the 1.5.0 / 1.5.1 / 1.5.2 entries below: the changelog had stopped at
  1.4.0 while the badge read 1.5.2 and three tagged releases shipped undocumented.

## [1.5.2] — 2026-06-20 — harden config-audit + non-blocking drift hooks

- config-audit: guard valid-JSON-but-wrong-shape configs (`settings.json` null/array,
  `enabledPlugins`/`hooks`/`permissions` non-object) that previously crashed the audit;
  flag `installPath: null` instead of skipping it.
- drift hooks: stream stdin instead of a blocking `readFileSync(0)`, so the Stop hook
  can't hang on a fd that doesn't close promptly.
- +13 tests (119 total): empty/malformed stdin, wrong-shape configs, Windows transcript path.

## [1.5.1] — 2026-06-20 — config-audit version drift on local marketplaces

- `/whippet-config` flags a plugin whose installed version is behind the version in its
  directory-marketplace source's `marketplace.json`. Deterministic and local (no network)
  — caught the hub's own whippet 1.4.0 vs 1.5.0 source. +2 tests (106 total).

## [1.5.0] — 2026-06-20 — config doctor + code↔docs drift hook

### Added
- **`/whippet-config`** — a deterministic, read-only config-drift audit (~18 checks:
  plugin enabled-vs-installed, cache/marketplace/hook/statusLine/MCP references, manifests,
  duplicate components, permissions, closed-set enums, frontmatter, malformed JSON, stale
  files). Covers the gaps the schema can't see.
- **code↔docs drift hook** (PostToolUse + Stop) — one quiet reminder when code changes but
  docs (`CLAUDE.md` / `README` / `docs/`) don't. Per-session state, off-switch, threshold-tunable.
- 104 isolated tests, hardened by an adversarial review (10 issues, 5 high, all fixed) and
  tried on a real hub (two false positives caught and fixed before shipping).

## [1.4.0] — 2026-06-19

### Fixed (adversarial review, round 4)
- **`detectModeChange` silently flipped mode on innocent prose** — `"normal mode"`
  in any sentence, `"stop whippet from deleting my tests"`, even asking `"should I
  use whippet full?"` all toggled state; and since the tracker only speaks on a
  change, the flip was silent (bloated diffs, no clue why). Now only a command at
  the **start of a message** flips it, the `normal mode` alias is gone, and the
  selftest locks the real prose probes instead of cherry-picked strings.
- **`loc_added` counted the net line delta** — an in-place rewrite (`return 1` →
  `return compute()`) scored 0, and LOC is the only axis with spread. Now counts
  lines added *or changed* (A/B numbers pre-date the fix; flagged in METHODOLOGY).
- **The grader ran without a timeout** — an infinite loop in a candidate (exactly
  the bug class under test) hung the harness. 10s timeout.
- **`reused` was a substring grep** — it counted a mention in a comment. Now strips
  line comments first: a call, not a mention.
- **`ponytail` (a competitor's name) was in the skill triggers** — removed.
- **README's flagship example had the `|| 0` footgun** — `Number(process.env.PORT)
  || 3000` returns 3000 for `PORT=0`, under a tagline that says "survives the edge
  cases". Fixed.
- **CI ran only `ubuntu-latest`** — the real risk surface is Windows (NTFS
  `renameSync`, Git Bash, path quoting). Added `windows-latest` to the matrix.

### Changed
- **Repositioned: the product is the three commands**, not the always-on engine.
  The drift pilot is a null and `CLAUDE.md` re-injects for free after compaction, so
  the README no longer sells the engine as the value — install-once portability plus
  the review/simplify/ledger commands is what a `CLAUDE.md` paste can't replicate.
- **Fixed the `reused` metric mislabel — whippet's last apparent edge was an
  artifact** (third review). The boolean had been recorded across three categories
  whose right answer is three *different* rungs (reuse existing code, take the
  stdlib, don't build it), so the /15 denominator pooled rungs that aren't reuse,
  and the whole reported "whippet 15/15 vs baseline 13/15" win was 2 runs in
  `trap_stdlib`. Removed the `reuse_marker` from `stdlib-uuid` and `yagni-config`
  (their real signal is already `deps_added` / `loc_added`), stripped the
  mislabelled `reused` field from those observations in `runs.jsonl` at the source
  (not just hidden in presentation), and scoped the scoreboard label to
  `trap_reuse`. Scored honestly, reuse is now 5/5 every arm — a tie. No metric
  separates whippet from the one-line baseline.
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
- **Drift-test harness** (`benchmarks/drift/`) — the executable form of the one
  experiment that can settle whippet's value: does the discipline persist across
  compaction *better* than a `CLAUDE.md` paste, or only as well? Three arms with
  identical content, different vehicle (A paste-once / B CLAUDE.md / C whippet);
  `discipline.txt` is held byte-equal to whippet's injected payload by a selftest;
  naive subject sessions (observer-effect controlled) run a fixed `task-stream.md`,
  meet the existing fixtures as traps after each `/compact`, and are scored by
  `score-drift.js` (reuses `bench-score.js`, adds the arm/session/compaction
  dimensions + a per-trap `lean_compliant` flag). `drift-report.js` reports per-arm
  compliance with Wilson CIs and the decisive **B-vs-C** gap. `PROTOCOL.md` is the
  step-by-step (isolated `CLAUDE_CONFIG_DIR` per arm, sample size, honest limits).
  Pre-registered prediction: **C ≈ B ≫ A** — whippet beats forgetting to persist,
  ties persisting via CLAUDE.md. Wired into `npm test`; not yet run.
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
