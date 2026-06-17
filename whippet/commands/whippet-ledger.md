---
description: List every whippet: debt marker in the repo — the deferred upgrades and their trigger conditions, flagging shortcuts that named no ceiling.
argument-hint: "[path, optional]"
---

Build the **ceiling ledger**: every deliberate shortcut marked `whippet:` in the
codebase, with its upgrade path. Scope: `$ARGUMENTS` if given, else the repo.

1. Find the markers. Prefer `git grep -nI "whippet:"`; if not a git repo, fall
   back to ripgrep `rg -nI "whippet:"`. (git grep already skips ignored paths;
   with rg, skip `node_modules`, `dist`, `build`, `.git`.)
2. For each hit capture `file:line` and the text after `whippet:`.
3. Classify each:
   - **Tracked debt** — names a ceiling or condition (mentions when/if/past/
     over/a threshold, or an explicit upgrade path).
   - **Bare marker** — a `whippet:` with no named ceiling. Flag it: a shortcut
     whose upgrade path isn't written is a decision nobody can revisit later.
4. Output a compact ledger, nothing else:
   ```
   CEILING LEDGER — <N> markers (<T> tracked, <B> bare)
   Tracked:
     path:line — <shortcut> → upgrade when <condition>
   Bare (add a ceiling):
     path:line — <shortcut>
   ```
   If there are zero markers, say so in one line and stop.
