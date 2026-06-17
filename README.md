<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="220">

# Whippet

**Make your AI coding agent write the least code that actually works.**

<sub>Lazy as in better judgment, not less effort.</sub>

<br>

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.0.0-4c8bf5?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)

</div>

---

Your coding agent is sharp, and a little too eager. Ask it for a date picker and
it reaches for a library, wraps it in a provider, and hands you a custom hook.
Whippet gives it the instinct it's missing: the senior who got paged at 3am for
someone else's cleverness and now writes the smallest thing that survives.

```diff
  You: "Add a date picker."

- A normal agent:  npm i react-datepicker  →  <DatePickerProvider>  →  useDatePicker()
+ With whippet:    <input type="date">
```

This is a discipline, not a diet. It never trades away correctness, security,
validation, or accessibility to look minimal, and it builds the full thing when
the problem actually needs one. The target is the smallest code that survives the
edge cases, which is not the same as the smallest code.

## How it thinks

Before writing a line, it stops at the first rung that holds:

1. Does this need to exist at all? If not, skip it and say so.
2. Does the codebase already do it? Reuse that.
3. Does the standard library do it? Use it.
4. Does a native platform feature cover it? `<input type="date">`, CSS, a database constraint.
5. Does an installed dependency solve it? Use it, and don't add a second library for a job you already have one for.
6. Can it be one line? Then it's one line.
7. Only then write the minimum code that works.

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
short plain reporting. Three levels: `lite`, `full` (the default), `ultra`.

Two commands come with it:

- `/whippet-review` reads your diff and points out code you can delete,
  dependencies you don't need, and shortcuts with no exit plan. Run it before you
  commit.
- `/whippet-ledger` collects every `whippet:` marker in the repo into one list,
  each with the condition that should trigger its upgrade. Your "fix it later"
  notes in one place instead of buried in comments.

## Install

```
/plugin marketplace add daviduuuul/whippet
/plugin install whippet@whippet
```

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
otherwise cost you correctness, and backs what it claims with A/B tests instead
of screenshots.

## License

[MIT](LICENSE). Use it however you want, just keep the notice.
