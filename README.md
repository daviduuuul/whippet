<div align="center">

# 🐕 Whippet

### Make your AI coding agent write the *least code that actually works.*

**Lazy as in better _judgment_, not less effort.**

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-1.0.0-4c8bf5?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)

</div>

---

Your coding agent is brilliant and a little too eager. Ask it for a date picker
and it installs a library, wraps it in a provider, and writes a custom hook.
Whippet gives it the one instinct it's missing: that of a senior developer who
has been paged at 3am for someone else's cleverness and now writes the smallest
thing that survives.

```diff
  You: "Add a date picker."

- A normal agent:  npm i react-datepicker  →  <DatePickerProvider>  →  useDatePicker()
+ With whippet:    <input type="date">
```

It's a discipline, not a diet. Correctness, security, validation, and
accessibility are never on the chopping block — whippet builds **fully** when the
problem genuinely needs it, and refuses to "simplify" away the things that bite
you at 3am.

## How it thinks — the ladder

Before writing a single line, it stops at the first rung that holds:

1. **Does this need to exist at all?** &nbsp;→&nbsp; skip it _(YAGNI)_
2. **Does our own codebase already do it?** &nbsp;→&nbsp; reuse it
3. **Does the standard library do it?** &nbsp;→&nbsp; use it
4. **Does a native platform feature cover it?** &nbsp;→&nbsp; `<input type="date">`, CSS, a DB constraint
5. **Does an installed dependency solve it?** &nbsp;→&nbsp; use it — never add a *second* library for a job you already have
6. **Can it be one line?** &nbsp;→&nbsp; one line
7. **Only then** &nbsp;→&nbsp; the minimum code that works

## Why not just "write less code"?

Because that's how you get a flimsy mess. Whippet is tuned from real A/B testing,
not headline percentages, and it knows exactly where lean is the **wrong** answer:

- 🔒 **Security primitives** use vetted libraries (bcrypt, argon2) — never
  hand-rolled to dodge a dependency.
- 🧪 **Non-trivial logic ships with one runnable check** — not a test it ran once
  and quietly deleted.
- 🧹 **It cleans up after itself** — no scratch files, no commented-out code, no
  half-applied edits left in your tree.
- ✂️ It cuts **complexity**, never **correctness**.

## What's in the box

| Component | What it does |
|---|---|
| **`whippet` skill** | The always-on discipline: the ladder, dependency hygiene, the security carve-out, the "leave a check" rule, clean-workspace habits, and a terse reporting style. Levels: `lite` · `full` · `ultra`. |
| **`/whippet-review`** | Scans your diff for removable code, needless dependencies, and shortcuts with no upgrade path. Run it before a commit. |
| **`/whippet-ledger`** | Lists every `whippet:` shortcut in the repo with its upgrade condition — your deferred decisions, never forgotten in a comment. |

## Install

```text
/plugin marketplace add daviduuuul/whippet
/plugin install whippet@whippet
```

## Update

When a new version ships, pull it:

```text
/plugin marketplace update whippet
/plugin update whippet@whippet
```

## Control

| Say this | And it… |
|---|---|
| `/whippet ultra` | goes maximally lean — deletion before addition |
| `/whippet full` | the default — the full ladder, enforced |
| `/whippet lite` | builds what you asked, names the leaner option |
| `stop whippet` | steps aside for the session |

## Credits

Whippet is original work, but it stands on two good ideas: the lazy-senior YAGNI
ladder of **[Ponytail](https://github.com/DietrichGebert/ponytail)** and the
terse-output instinct of **[Caveman](https://github.com/JuliusBrussee/caveman)**.
It folds both into a single discipline, scopes them so they never trade away
correctness, and earns its claims from A/B tests instead of LinkedIn screenshots.

## License

[MIT](LICENSE) — do what you like, just keep the notice.

---

<div align="center">
<sub>The best code is the code you never wrote.<br>The second best is the smallest correct thing that survives the edge cases.</sub>
</div>
