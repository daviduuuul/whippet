---
description: Scan the current git diff for removable code, unjustified dependencies, and whippet shortcuts missing their ceiling.
argument-hint: "[path or commit range, optional]"
---

Apply the **whippet** review lens to the current changes. Scope: `$ARGUMENTS` if
given, else the working diff.

1. Get the diff: `git diff --staged` and `git diff` (or the range in
   `$ARGUMENTS`). If nothing is staged or changed, say so and stop.
2. Review each changed hunk. Flag only real issues — the same lean lens as
   `/whippet-simplify` step 2 (dead/removable code, reinvented logic, redundant
   dependency, premature abstraction, needless indirection), **diagnose-only** here,
   naming the existing symbol when something is reinvented. Plus the checks that are
   review's own:
   - **`whippet:` without a ceiling:** run `node "${CLAUDE_PLUGIN_ROOT}/scripts/marker.js"
     <changed files> --json` and flag every `bare:true` — a shortcut naming no `until:` upgrade path.
   - **Missing check:** non-trivial logic with no runnable check left behind.
   - **Oversized batch:** a hunk mixing unrelated changes, or a diff too large to
     review in one pass — flag the split (one logical, revertible change per
     commit). Big batches are where AI-written bugs slip past review.
   - **Over-cut (the other failure):** error handling, validation, security, or
     disposal removed to shrink the diff — flag as a regression, not a win.
3. Do **not** rewrite anything. Output a short list, most-impactful first:
   `file:line — issue — leaner fix (one line)`. End with a one-line verdict
   (ship as-is / trim first). No essay.
