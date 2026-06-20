<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="220">

# Whippet

**Three lean tools for Claude Code.**
**Keep your code, your config, and your docs from quietly bloating and drifting apart.**

<sub>Honest by default — measured where it can be, deterministic where it can't, and upfront about where it doesn't help.</sub>

<br>

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.5.3-4c8bf5?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)

</div>

---

## What it is

Three small tools, one job: keep your Claude Code setup **lean and un-rotted**. Install once, they work in every repo.

| | |
|---|---|
| **Lean code** | An always-on discipline that writes the least code that actually works — plus `/whippet-review`, `/whippet-simplify`, `/whippet-ledger`. |
| **Lean config** | `/whippet-config` audits your Claude Code setup for drift: dead plugin / hook / MCP / statusLine references, fragile local marketplaces, out-of-date plugins, malformed JSON, orphaned files. Deterministic, read-only. |
| **No silent rot** | A turn-end hook flags when you change code but not the docs (`CLAUDE.md` / `README` / `docs/`). |

## Honest by default

The part most plugins skip — and the reason to trust the rest.

- **The lean-code discipline ties a one-liner.** In a paired A/B it matched a plain *"write less code"* nudge: **3.9 vs 3.6** lines added, **25/25** correct, **0** dependencies either way. It doesn't beat a good prompt — the [benchmark note](benchmarks/results/2026-06-19-opus-ab.md) says so in full. What it sells is portability: installed once and dialled, instead of pasted into every repo's `CLAUDE.md`.
- **The other two are deterministic, not magic.** `/whippet-config` and the drift hook carry no benchmark because they don't need one — they read your files and report facts, nothing inferred.
- **Every public claim is backed by a paired run, or it isn't made.** Nulls published, fixtures kept private ([methodology](benchmarks/METHODOLOGY.md)).

---

## Lean code — the discipline

Coding agents are fast and a little greedy. Ask for one thing and you get three: a library where a built-in would do, a wrapper around the library, a hook around the wrapper. It all works today. You maintain it forever.

```diff
  "Give me a unique id."
- const { v4 } = require('uuid')      // a new dependency
+ crypto.randomUUID()                 // already in Node

  "Read PORT, default to 3000."
- class Config { /* 30 lines, one schema, one default */ }
+ process.env.PORT ? Number(process.env.PORT) : 3000
```

A short ladder, stopping at the first rung that answers the need: **skip it · reuse it · standard library · free from the platform · already a dependency · one line · just enough code.**

It won't make you less safe — these lines it never cuts:

- **Security stays vetted** — bcrypt/argon2, never hand-rolled.
- **Logic ships with a check** — one small runnable test beside the code.
- **Untrusted input gets guarded** — validation and error handling are never trimmed to look small.
- **Your tree stays clean** — no scratch files, no commented-out blocks.

Dial it with `/whippet lite` · `/whippet full` (default) · `/whippet ultra`; pause with `stop whippet`. And three commands a `CLAUDE.md` paragraph can't give you:

| | |
|---|---|
| **`/whippet-review`** | Flags code to delete, dependencies you don't need, and shortcuts with no exit plan. Run it before you commit. |
| **`/whippet-simplify`** | Applies the review — deletes dead code, swaps a dependency for the platform, tightens the rest — and refuses to cut a validation, a guard, or your one check. |
| **`/whippet-ledger`** | Collects every deferred decision with the condition that should reopen it, so a shortcut never disappears into the source. |

All three take an optional path or commit range and otherwise default to the working diff.

## Lean config — `/whippet-config`

Your setup drifts: a plugin gets disabled but is still documented, a hook points at a moved script, a local marketplace breaks when you rename a folder, an installed plugin falls behind its source, backups pile up. `/whippet-config` reads the actual config files and reports the drift — **deterministic, read-only, no guessing**.

```
CONFIG AUDIT — 0 errors · 1 warning · 3 info

WARNINGS — fragile / silent failures
  plugin out of date: foo@bar — installed 1.0.0, source is 1.2.0
    fix: run /plugin update to sync the cache
INFO — cleanup candidates
  3× backup inside config dir — move them out or delete
```

It covers the gaps the JSON schema can't, across both `settings.json` and `settings.local.json`: enabled-vs-installed plugins, broken hook / MCP / statusLine references, fragile local marketplaces, version drift, duplicate components, malformed JSON, orphaned files. It reports the fix; you decide.

## Code↔docs drift — the hook

Change code but not the docs and they rot apart silently. A turn-end hook notices: edit several code files in a session without touching `CLAUDE.md` / `README` / `docs/`, and it surfaces **one** quiet reminder. It's path-only — it sees that *some* docs file changed, not whether the docs actually cover the code. Per-session, low-noise; tune the code-edit count that trips it with `WHIPPET_DRIFT_THRESHOLD` (default 3), turn it off with `WHIPPET_DRIFT_OFF=1`.

## Install

```
/plugin marketplace add daviduuuul/whippet
/plugin install whippet@whippet
```

Node.js powers the hooks; the skill and commands work without it.

**Update:** `/plugin marketplace update whippet` then `/plugin update whippet@whippet`.

## License

[MIT](LICENSE). Use it however you want, just keep the notice.
