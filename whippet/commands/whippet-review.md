---
description: Scan the current git diff for removable code, unjustified dependencies, and whippet shortcuts missing their ceiling.
argument-hint: "[path or commit range, optional]"
---

Apply the **whippet** review lens to the current changes. Scope: `$ARGUMENTS` if
given, else the working diff.

1. Get the diff: `git diff --staged` and `git diff` (or the range in
   `$ARGUMENTS`). If nothing is staged or changed, say so and stop.
2. Review each changed hunk. Flag only real issues:
   - **Removable / dead:** code, files, or branches nothing needs (YAGNI).
   - **Reinvented:** logic stdlib, a native platform feature, or existing code
     already covers (name the existing symbol if you find it).
   - **Unjustified dependency:** a new dep doing what a few lines or an installed
     package would; a duplicate or overlapping library.
   - **Premature abstraction:** interface/factory/config with a single use.
   - **`whippet:` without a ceiling:** a shortcut comment naming no upgrade path.
   - **Missing check:** non-trivial logic with no runnable check left behind.
   - **Over-cut (the other failure):** error handling, validation, security, or
     disposal removed to shrink the diff — flag as a regression, not a win.
3. Do **not** rewrite anything. Output a short list, most-impactful first:
   `file:line — issue — leaner fix (one line)`. End with a one-line verdict
   (ship as-is / trim first). No essay.
