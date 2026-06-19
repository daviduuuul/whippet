<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="220">

# Whippet

**Your AI agent writes more code than the job needs.**
**Whippet trims it to the part that earns its keep — and never the part that keeps you safe.**

<sub>The least code that survives the edge cases. On by default, every session.</sub>

<br>

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.4.0-4c8bf5?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)

</div>

---

## The problem

Coding agents are fast and a little greedy. Ask for one thing and you get three:
a library where a built-in would do, a wrapper around the library, a hook around
the wrapper. It all works today. You maintain it forever.

Whippet gives the agent the judgment of someone who has paid that maintenance
bill, and writes the smallest thing that holds.

## What it looks like

```diff
  "Give me a unique id."
- const { v4 } = require('uuid')      // a new dependency
+ crypto.randomUUID()                 // already in Node

  "Read PORT, default to 3000."
- class Config { /* 30 lines, one schema, one default */ }
+ process.env.PORT ? Number(process.env.PORT) : 3000
```

Same behavior. Less to read, review, and live with.

## It won't make you less safe

Lean done carelessly is just fragile, so Whippet knows the lines it doesn't cross:

- **Security stays vetted.** Hashing and crypto reach for bcrypt or argon2, never a hand-rolled shortcut.
- **Logic ships with a check.** One small test you can actually run, committed beside the code — not run once and thrown away.
- **Untrusted input gets guarded.** Validation and error handling are never the lines it cuts to look small.
- **Your tree stays clean.** No scratch files, no commented-out blocks, nothing half-finished.

Ask for the full version and that *is* the spec. It builds the full thing.

## What the benchmark actually says

No slide, no screenshot — an A/B harness ([methodology](benchmarks/METHODOLOGY.md)),
nulls published.

The honest read of the first run: a disciplined agent ships diffs ~5× smaller than
an un-nudged one at identical correctness — but a one-line *"write less code"*
nudge gets the **same** result. On the artifact, whippet **ties** the one-liner; it
doesn't beat it. So whippet isn't selling you a magic number.

What it sells is that discipline made portable: installed once and applied in every
repo, dialled (`lite` / `full` / `ultra`), with the review, simplify, and ledger
commands — instead of a paragraph you paste into each project's `CLAUDE.md` by hand.
The content is curated and the guards are tested; the packaging is the product.

What it will never do is claim a win it didn't measure. (Smaller diffs are the
lever Google's 2025 [DORA report](https://dora.dev/dora-report-2025/) ties to lower
delivery instability.)

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

The product is the **commands** — a reviewer, an apply pass, and a ledger that a
paragraph in `CLAUDE.md` doesn't give you. The always-on anchor is a convenience
on top, not the value: it persists the discipline the way a `CLAUDE.md` paste
already does ([benchmark note](#what-the-benchmark-actually-says)).

| | |
|---|---|
| **`/whippet-review`** | Reads your diff and flags code to delete, dependencies you don't need, and shortcuts with no exit plan. Run it before you commit. |
| **`/whippet-simplify`** | The apply half of the review: deletes dead code, swaps a dependency for the platform, tightens the rest — and refuses to simplify away a validation, a security guard, or your one runnable check. Language-agnostic, leaves a passing check behind, flags anything risky instead of touching it. |
| **`/whippet-ledger`** | Collects every deferred decision into one list, each with the condition that should reopen it — so a shortcut never disappears into the source. |
| **Three intensities** | `/whippet lite` · `/whippet full` (default) · `/whippet ultra`, at the start of a message. `stop whippet` pauses it for the session. |
| **Always on** *(convenience)* | A session hook re-anchors the discipline at startup and after a context compaction, so it doesn't quietly vanish. No per-turn token tax. Persists like a `CLAUDE.md` would — install-once across every repo is the gain, not a mechanism edge. |

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
