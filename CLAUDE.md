# Whippet — project context

Claude Code plugin: a lean-code discipline ("the least code that actually works") plus
terse, concrete reporting. Shipped through a single-plugin marketplace. MIT, public repo
(`daviduuuul/whippet`).

## Layout — repo root ≠ plugin

The shippable plugin is the **nested `whippet/` dir**; the repo root is the marketplace
wrapper + dev tooling. Don't edit plugin files expecting repo tooling to live beside them.

- `whippet/` — the plugin (`source: ./whippet`)
  - `.claude-plugin/plugin.json` — plugin manifest
  - `skills/whippet/SKILL.md` — the discipline itself (**the product**)
  - `commands/` — `/whippet-review`, `/whippet-simplify`, `/whippet-ledger`, `/whippet-config`
  - `hooks/` — plugin runtime hooks (`hooks.json`, `whippet-*.js`) + `selftest.js`
  - `scripts/` — `config-audit.js` (the config-doctor engine, invoked by `/whippet-config`) + `config-audit.test.js`
- `.claude-plugin/marketplace.json` — marketplace entry
- `scripts/` — dev tooling: `bump.js`, `check-manifests.js`, `bench-report.js`, `on-edit.js`
- `benchmarks/` — A/B harness, fixtures, `METHODOLOGY.md`
- `.claude/settings.json` — **repo dev hooks** (not the plugin's)
- `.serena/` — Serena project memory

## Commands

```bash
npm test        # selftest.js + check-manifests.js + judge.js selftest   (CI: Node 22)
npm run bump    # bump version across all 4 manifests — never edit by hand
npm run bench   # aggregate benchmarks/results/* into one scoreboard (CIs, per-category)
```

## Two hook layers — don't conflate them

- **Plugin hooks** (`whippet/hooks/hooks.json`) — ship to users. `SessionStart` →
  `whippet-activate.js`; `UserPromptSubmit` → `whippet-mode-tracker.js`. Mode logic lives in
  `whippet-core.js` (default `full`; persisted in flag file `$CLAUDE_CONFIG_DIR/.whippet-active`).
  `PostToolUse(Edit|Write|MultiEdit)` → `whippet-drift-track.js` and `Stop` →
  `whippet-drift-check.js` — code↔docs drift: track edited code vs docs in a per-session state
  file, surface **one** yellow advisory per wave when code changed but no docs did. Logic in
  `whippet-drift-core.js`; off with `WHIPPET_DRIFT_OFF=1`, threshold via `WHIPPET_DRIFT_THRESHOLD`.
- **Repo dev hook** (`.claude/settings.json`) — local only. `PostToolUse(Edit|Write)` →
  `scripts/on-edit.js` reruns the suite when you touch hooks / scripts / manifests / README and
  blocks (exit 2) on failure. Whippet dogfooding its own "always-on runnable check".

## Gotchas

- **Version lives in 4 files** — `package.json` (source of truth), `whippet/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, and the README badge. `check-manifests.js` fails the build on
  any desync, so always `npm run bump` instead of hand-editing.
- **Hooks must never throw** — they read stdin JSON, exit 0 silently, and speak only when a real
  check fails (exit 2 feeds stderr back to the agent). Preserve that contract.
- **Vanilla Node, zero deps** — CommonJS, Node ≥22, no `dependencies` in `package.json`. Don't pull
  a library into hook/script code.
- **Benchmarks are law** (`benchmarks/METHODOLOGY.md`): every README claim must be backed by a paired
  A/B (`off` / one-line `baseline` / `whippet`); correctness is a hard gate; **fixtures stay private**
  (anything public leaks into training); report confidence intervals + per-category splits; never
  self-report numbers from a manifest.

## Scope discipline (this repo, of all repos)

Whippet's value is a **narrow** scope: leanness where it pays — *the least that actually works,
and nothing left rotting in place*. Two fronts, one discipline:
- **Lean code output + terse reporting** — the original product (skill + `/whippet-review` /
  `/whippet-simplify` / `/whippet-ledger`).
- **Lean setup** — `/whippet-config` audits the Claude Code config for drift (dead plugin/hook/MCP
  references, fragile local marketplaces, duplicate components, malformed JSON, orphaned files), so
  the setup stays as lean and un-rotted as the code. Detect-only; deterministic; no `$schema` work
  it already does — it covers the *gaps* the schema can't (referents and runtime).

Still **out of scope**: planning, orchestration, general context-engineering — anything that
doesn't serve leanness. New behavior ships with a runnable check (`selftest.js` or
`scripts/*.test.js`), and if it makes a public claim, a benchmark to back it.
