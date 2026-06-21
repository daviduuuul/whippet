---
description: Audit a project's package.json for dependencies the platform or stdlib already covers, declared-but-unused packages, and duplicate-purpose libraries. Read-only: it reports, it fixes nothing.
argument-hint: "[project dir, optional]"
---

Run a **read-only dependency-leanness audit** and report what the platform could
replace. The facts come from a deterministic collector (it reads `package.json` and
the sources — no guessing); your job is to run it and present what it found.

1. Run the collector. If `$ARGUMENTS` names a project dir, pass it; otherwise it
   resolves to the current directory:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/deps-audit.js" --json
   ```
   Append `--dir "$ARGUMENTS"` only if `$ARGUMENTS` is non-empty.
2. Parse the JSON `{ summary, findings }`. Each finding has `severity`
   (`error` | `warning` | `info`), `category` (`native` | `unused` | `duplicate` |
   `deps`), `title`, `detail`, `fix`, `evidence`.
3. Present them grouped by severity, **errors first**, terse — no preamble:
   ```
   DEPS AUDIT — <E> errors · <W> warnings · <I> info

   WARNINGS — a native/stdlib equivalent exists
     <title> — <detail>
       fix: <fix>   [<evidence>]
   INFO — verify before acting
     ...
   ```
   If there are zero findings, say `clean — no avoidable dependencies detected` and stop.
4. **Do not modify anything.** This command is detect-only and conservative on
   purpose: an `unused` finding is a *candidate* (a dynamic require can be missed),
   and a `native` swap is gated on the project's Node engine. Removing or swapping a
   dependency is the user's call — verify, then do it by hand.
