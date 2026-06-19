<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="220">

# Whippet

**Your AI agent writes more code than the job needs.**
**Whippet trims it to the part that earns its keep — and never the part that keeps you safe.**

<sub>The least code that survives the edge cases. On by default, every session.</sub>

<br>

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.3.0-4c8bf5?style=flat-square)](#)
[![Benchmarked](https://img.shields.io/badge/benchmarked-A%2FB-8957e5?style=flat-square)](benchmarks/)
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
+ Number(process.env.PORT) || 3000
```

Same behavior. Less to read, review, and live with.

## It won't make you less safe

Lean done carelessly is just fragile, so Whippet knows the lines it doesn't cross:

- **Security stays vetted.** Hashing and crypto reach for bcrypt or argon2, never a hand-rolled shortcut.
- **Logic ships with a check.** One small test you can actually run, committed beside the code — not run once and thrown away.
- **Untrusted input gets guarded.** Validation and error handling are never the lines it cuts to look small.
- **Your tree stays clean.** No scratch files, no commented-out blocks, nothing half-finished.

Ask for the full version and that *is* the spec. It builds the full thing.

## The number

No slide, no screenshot. We A/B test it ([methodology](benchmarks/METHODOLOGY.md)).

Left un-nudged, even a strong 2026 model ships diffs about **5× larger** than a
disciplined one, at identical correctness. Whippet keeps the discipline on
automatically, every turn. And it publishes the runs where it only *ties* a
one-line reminder, not just the ones it wins: a tool that hides its losses has
earned less trust on its wins.

Smaller diffs are also the lever Google's 2025
[DORA report](https://dora.dev/dora-report-2025/) ties to lower delivery
instability — big batches are exactly where an agent's subtly-wrong line slips
past review.

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

| | |
|---|---|
| **Always on** | A session hook re-applies the discipline at startup and on every turn. It doesn't drift mid-session or vanish after a context compaction. |
| **Three intensities** | `/whippet lite` · `/whippet full` (default) · `/whippet ultra`. `stop whippet` pauses it for the session. |
| **`/whippet-review`** | Reads your diff and flags code to delete, dependencies you don't need, and shortcuts with no exit plan. Run it before you commit. |
| **`/whippet-ledger`** | Collects every deferred decision into one list, each with the condition that should reopen it — so a shortcut never disappears into the source. |

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
