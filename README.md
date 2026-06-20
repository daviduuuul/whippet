<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="220">

# Whippet

**Most "lean code" plugins sell you a number they can't back up.**
**Whippet ships the discipline — and the receipts.**

<sub>A lean-code discipline for Claude Code that measured itself against a one-line baseline, published the nulls, and tells you exactly where it wins and where it doesn't.</sub>

<br>

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.5.1-4c8bf5?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)

</div>

---

## The problem

Coding agents are fast and a little greedy. Ask for one thing and you get three:
a library where a built-in would do, a wrapper around the library, a hook around
the wrapper. It all works today. You maintain it forever.

Whippet gives the agent the judgment of someone who has paid that maintenance
bill, and writes the smallest thing that holds.

```diff
  "Give me a unique id."
- const { v4 } = require('uuid')      // a new dependency
+ crypto.randomUUID()                 // already in Node

  "Read PORT, default to 3000."
- class Config { /* 30 lines, one schema, one default */ }
+ process.env.PORT ? Number(process.env.PORT) : 3000
```

Same behavior. Less to read, review, and live with.

## Honest by default

This is the part most plugins skip. Whippet ran the experiment and published what
it found, including the parts that don't flatter it:

- **It ties a one-line nudge.** In a paired A/B, whippet matched a plain *"write
  less code"* instruction: **3.9 vs 3.6** lines added, **25/25** correct, **0**
  dependencies either way. It does not beat a good prompt, and the
  [benchmark note](benchmarks/results/2026-06-19-opus-ab.md) says so in full.
- **The always-on engine isn't magic.** A drift test on whether it survives a
  context compaction *better* than a pasted `CLAUDE.md` came back a null — a paste
  persists for free too. Documented, not buried.
- **Every claim is backed by a paired run, or it isn't made.** Nulls published,
  fixtures kept private, no self-reported manifest numbers
  ([methodology](benchmarks/METHODOLOGY.md)).

So what *is* the product? Not a magic number. **Portable discipline, tested guards,
and a set of commands and hooks** — installed once instead of pasted into every repo.
Modest, real, and measured. The reason to trust the lean advice it gives is the same
reason it told you the above: it doesn't pretend.

## It won't make you less safe

Lean done carelessly is just fragile, so whippet knows the lines it doesn't cross:

- **Security stays vetted.** Hashing and crypto reach for bcrypt or argon2, never a hand-rolled shortcut.
- **Logic ships with a check.** One small test you can actually run, committed beside the code.
- **Untrusted input gets guarded.** Validation and error handling are never the lines it cuts to look small.
- **Your tree stays clean.** No scratch files, no commented-out blocks, nothing half-finished.

Ask for the full version and that *is* the spec. It builds the full thing.

## How it decides

A short ladder. It stops at the first rung that answers the need:

1. **Skip it?** If the work isn't needed, drop it and say so.
2. **Reuse it?** If it's already in your codebase, call that.
3. **Standard library?** Take it.
4. **Free from the platform?** A native input, a CSS rule, a database constraint.
5. **Already a dependency?** Use it. Never add a second tool for a job one you have can do.
6. **One line?** Then one line.
7. **Otherwise** — just enough code to work.

## What you get

The product is the **commands and hooks** — a reviewer, an apply pass, a ledger, and a
config auditor that a paragraph in `CLAUDE.md` doesn't give you.

| | |
|---|---|
| **`/whippet-review`** | Reads your diff and flags code to delete, dependencies you don't need, and shortcuts with no exit plan. Run it before you commit. |
| **`/whippet-simplify`** | The apply half of the review: deletes dead code, swaps a dependency for the platform, tightens the rest — and refuses to simplify away a validation, a security guard, or your one runnable check. |
| **`/whippet-ledger`** | Collects every deferred decision into one list, each with the condition that should reopen it — so a shortcut never disappears into the source. |
| **`/whippet-config`** | Audits your Claude Code setup for config drift — broken plugin / hook / MCP / statusLine references, fragile local marketplaces, duplicate components, malformed JSON, orphaned files. Deterministic and read-only: it reports the drift and the fix, you decide. |
| **Three intensities** | `/whippet lite` · `/whippet full` (default) · `/whippet ultra`, at the start of a message. `stop whippet` pauses it for the session. |
| **Always on** *(convenience)* | A session hook re-anchors the discipline at startup and after a context compaction. No per-turn token tax. Persists like a `CLAUDE.md` would — install-once across every repo is the gain. |
| **Code↔docs drift** *(hook)* | Change code but not the docs (`CLAUDE.md` / `README` / `docs/`) and a turn-end hook surfaces one quiet reminder — so the docs don't silently rot behind the code. Off with `WHIPPET_DRIFT_OFF=1`. |

## Install

```
/plugin marketplace add daviduuuul/whippet
/plugin install whippet@whippet
```

Node.js powers the always-on hook. The skill and commands work without it.

**Update**

```
/plugin marketplace update whippet
/plugin update whippet@whippet
```

## License

[MIT](LICENSE). Use it however you want, just keep the notice.
