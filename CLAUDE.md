# Whippet — project context

Claude Code plugin: a **config-drift auditor for Claude Code setups**. Read-only, deterministic,
zero deps. Shipped through a single-plugin marketplace. MIT, public repo (`daviduuuul/whippet`).

> The lean-code discipline whippet used to ship was removed in **3.0.0** — that role moved to the
> `ponytail` plugin. Don't reintroduce skill/discipline/mode/marker/deps code here.

## Layout — repo root ≠ plugin

The shippable plugin is the **nested `whippet/` dir**; the repo root is the marketplace
wrapper + dev tooling. Don't edit plugin files expecting repo tooling to live beside them.

- `whippet/` — the plugin (`source: ./whippet`)
  - `.claude-plugin/plugin.json` — plugin manifest
  - `commands/whippet-config.md` — `/whippet-config`, the on-demand full audit (**the product**)
  - `hooks/` — `hooks.json`, `whippet-config-check.js` (the SessionStart advisory) + its `*.test.js`
  - `scripts/` — `config-audit.js` (the engine, powers both `/whippet-config` and the advisory) + `config-audit.test.js`
- `.claude-plugin/marketplace.json` — marketplace entry
- `scripts/` — dev tooling: `bump.js`, `check-manifests.js`, `on-edit.js`
- `benchmarks/config-eval/` — the config-audit A/B eval (corpus + `eval.js`)
- `.claude/settings.json` — **repo dev hooks** (not the plugin's)
- `.serena/` — Serena project memory

## Commands

```bash
npm test        # config-audit.test.js + whippet-config-check.test.js + check-manifests.js   (CI: Node 22)
npm run bump    # bump version across all 4 manifests — never edit by hand
```

## Hooks — two layers, don't conflate them

- **Plugin hook** (`whippet/hooks/hooks.json`) — ships to users. `SessionStart(startup)` →
  `whippet-config-check.js`: runs the config audit and writes **one** quiet advisory to stdout
  **only when there are errors** (warnings/info wait for `/whippet-config`). Off with
  `WHIPPET_CONFIG_OFF=1`. Depends only on `../scripts/config-audit.js`.
- **Repo dev hook** (`.claude/settings.json`) — local only. `PostToolUse(Edit|Write)` →
  `scripts/on-edit.js` reruns the suite when you touch hooks / scripts / manifests / README and
  blocks (exit 2) on failure. Whippet dogfooding its own "always-on runnable check".

## Gotchas

- **Version lives in 4 files** — `package.json` (source of truth), `whippet/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, and the README badge. `check-manifests.js` fails the build on
  any desync, so always `npm run bump` instead of hand-editing.
- **Hooks must never throw** — they read stdin JSON, exit 0 silently, and speak only when a real
  check fails. Preserve that contract.
- **Vanilla Node, zero deps** — CommonJS, Node ≥22, no `dependencies` in `package.json`. Don't pull
  a library into hook/script code.
- **`config-audit` is detect-only** — it reads config files and reports; it never edits them. Keep it
  conservative: a finding fires only when a referent is genuinely broken/missing, so the autonomous
  advisory never nags. New checks ship with cases in `config-audit.test.js`.

## README — keep it minimal (owner's standing instruction)

The README is **only**: a centered header (logo + a small badge row + a one-line
italic tagline) + a short paragraph of what the plugin does + the install block.
That header is **visual polish, not content** — still **nothing else**: no benchmark
tables, no command lists, no honesty essays, no examples. Keep it accurate (update the
one paragraph if what the plugin does changes). The version badge is one of the four synced
manifests — `npm run bump` moves it, never hand-edit (`check-manifests.js` greps `version-<v>-`).

## Privacy — never leak private things into the public repo (owner's standing instruction)

This is a **public repo**. Nothing about the owner's private setup belongs in any tracked file
— code, tests, benchmarks, corpora, or docs. Before committing, never include:
- personal paths (`C:\Users\<name>\…`) or the private hub (`C:\ClaudeCode\…`);
- real hook/guard script names, real `settings.json`/MCP config, `MEMORY_FILE_PATH`, or any live
  config from the owner's machine — synthetic corpora use **generic placeholders**
  (`./hooks/*.ps1`, `$CLAUDE_CONFIG_DIR`, `./memory.jsonl`, `C:\path\to\…`, `$env:TEMP\…`);
- secrets / tokens / keys, even in examples (use `${ENV_VAR}` placeholders);
- names of the owner's other projects.

The repo ships **only the product and its public tooling**: the plugin (`whippet/` — command,
hooks, scripts), the marketplace wrapper, the dev tooling, and the config-eval benchmark with
sanitized synthetic data. Private working docs (ideas, roadmaps, research, scratch notes) stay
**out of git**, under the gitignored `research/` or `.scratch/` dirs — never committed. (See
`.gitignore`.) When in doubt, sanitize or keep it local.

## Scope discipline (this repo, of all repos)

Whippet's value is a **narrow** scope: **one front** — auditing the Claude Code setup for the
drift the schema can't catch. `/whippet-config` (and the SessionStart advisory) audit
`settings.json` and `settings.local.json` for dead plugin/hook/MCP references, fragile local
marketplaces, duplicate components, malformed JSON, mistyped settings keys, and orphaned files.
Detect-only, deterministic, conservative — it covers the *gaps* the schema can't (referents and
runtime).

Still **out of scope**: lean-code discipline (that's `ponytail` now), dependency auditing, code↔docs
drift, planning, orchestration — anything that isn't config auditing. New behavior ships with a
runnable check (`scripts/*.test.js` or `hooks/*.test.js`), and if it makes a public claim, the
`config-eval` benchmark to back it.
