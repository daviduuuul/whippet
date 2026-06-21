---
description: List every whippet: debt marker in the repo — the deferred upgrades and their trigger conditions, flagging shortcuts that named no ceiling.
argument-hint: "[path, optional]"
---

Build the **ceiling ledger**: every deliberate shortcut marked `whippet:` in the
codebase, with its upgrade path. Scope: `$ARGUMENTS` if given, else the repo.

1. List the files carrying a marker: `git grep -lI "whippet:"` (if not a git repo,
   `rg -lI "whippet:"`, skipping `node_modules`, `dist`, `build`, `.git`). Narrow to
   `$ARGUMENTS` if given.
2. Classify deterministically — run the parser, don't eyeball it:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/marker.js" <files> --json`. Each hit is
   `{file, line, shortcut, until, bare}`: `bare:false` = **tracked** (an `until:`
   ceiling is written), `bare:true` = a **bare** marker with no ceiling (a shortcut
   whose upgrade path isn't written is a decision nobody can revisit later).
3. Output a compact ledger, nothing else:
   ```
   CEILING LEDGER — <N> markers (<T> tracked, <B> bare)
   Tracked:
     path:line — <shortcut> → upgrade when <until>
   Bare (add a ceiling):
     path:line — <shortcut>
   ```
   Running `node marker.js <files>` without `--json` prints exactly this. If there
   are zero markers, say so in one line and stop.
