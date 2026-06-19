<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="220">

# Whippet

**Make your AI coding agent write the least code that actually works.**

<sub>Fewer lines, because you know which ones carry weight.</sub>

<br>

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.3.0-4c8bf5?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)

</div>

---

Your coding agent is sharp, and a little too eager. Ask it for a date picker and
it reaches for a library, wraps it in a provider, and hands you a custom hook.
Whippet gives it the instinct it's missing: the one that has had to maintain that
kind of cleverness later, and now writes the smallest thing that survives.

```diff
  You: "Add a date picker."

- A normal agent:  npm i react-datepicker  →  <DatePickerProvider>  →  useDatePicker()
+ With whippet:    <input type="date">
```

This is a discipline, not a diet. It never trades away correctness, security,
validation, or accessibility to look minimal, and it builds the full thing when
the problem actually needs one. The target is the smallest code that survives the
edge cases, which is not the same as the smallest code.

Honest expectation: on a strong 2026 model, whippet will not dramatically shrink
your code, because the model is already fairly lean. We measured that instead of
guessing it ([benchmarks](benchmarks/)). What it reliably does is keep the
discipline the model skips on its own: leave a runnable check, refuse a duplicate
dependency, reach for a vetted crypto library instead of hand-rolling, clean up
its own scratch files, and report back in short plain language instead of a wall
of text. Lean and safe, every session.

The point was never fewer characters — it's smaller, more reviewable diffs, the
lever [Google's 2025 DORA report](https://dora.dev/dora-report-2025/) ties to
*lower software-delivery instability* (large batches are exactly where AI's
subtly-wrong code slips past review).

## How it thinks

It walks a short ladder and stops the moment one rung answers the need:

1. Can this be skipped entirely? If so, skip it and say so.
2. Is it already in the codebase? Call that.
3. Is it in the standard library? Use it.
4. Does the platform give it for free? `<input type="date">`, CSS, a database constraint.
5. Is it already a dependency? Use it — don't pull a second library for a job one you have can do.
6. Does it fit in one line? Then it's one line.
7. Otherwise, just enough code to work.

It's the same instinct [Anthropic's own prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
asks for — *"avoid over-engineering; only make changes that are directly
requested or clearly necessary"* — made always-on, dialled, and measured.

## Where "less code" goes wrong

Lean done carelessly is just fragile, so whippet knows the spots where small is
the wrong call.

Password hashing, encryption, anything security-shaped reaches for a vetted
library like bcrypt or argon2. It will not hand-roll crypto to save a dependency.

Anything with real logic ships with one small check you can actually run, not a
test it ran once and threw away.

And it cleans up after itself. No scratch files, no commented-out blocks, nothing
half-finished left in your tree.

It cuts complexity, never correctness. The claims here come from real A/B runs,
not a percentage off a slide.

## What you get

The `whippet` skill is that discipline, always on: the ladder, dependency
hygiene, the security exceptions, the leave-a-check habit, a tidy workspace, and
short, plain reporting (the readable half of caveman-style terseness, without the
grunt). Three levels: `lite`, `full` (the default), `ultra`.

It stays on for real. A session hook re-applies the discipline at startup and on
every turn, so it does not drift mid-session or vanish after a context
compaction. Switch levels with `/whippet ultra`, or `stop whippet` to pause it.

Two commands come with it:

- `/whippet-review` reads your diff and points out code you can delete,
  dependencies you don't need, and shortcuts with no exit plan. Run it before you
  commit.
- `/whippet-ledger` gathers every `whippet:` marker in the repo into one list,
  each with the condition that should trigger its rework — so a deferred decision
  stays in view instead of disappearing into the source.

## Install

```
/plugin marketplace add daviduuuul/whippet
/plugin install whippet@whippet
```

Requires Node.js for the always-on hook. The skill and commands work without it.

## Update

```
/plugin marketplace update whippet
/plugin update whippet@whippet
```

## Turn it up, down, or off

| Say this | And it does this |
|:---|:---|
| <kbd>/whippet ultra</kbd> | goes as lean as it gets: delete first, push back on the rest of the request |
| <kbd>/whippet full</kbd> | the default |
| <kbd>/whippet lite</kbd> | builds what you asked and just names the leaner option |
| <kbd>stop whippet</kbd> | steps aside for the rest of the session |

## Credits

Original work, but it owes two earlier projects:
[Ponytail](https://github.com/DietrichGebert/ponytail) for the lazy-senior YAGNI
ladder, and [Caveman](https://github.com/JuliusBrussee/caveman) for short agent
replies. Whippet puts both in one place, draws the lines where they would
otherwise cost you correctness, and backs what it claims with
[A/B tests](benchmarks/) instead of screenshots, including where it does not help.

## License

[MIT](LICENSE). Use it however you want, just keep the notice.
