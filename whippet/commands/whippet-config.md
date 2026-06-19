---
description: Audit this Claude Code setup for config drift — broken plugin/hook/MCP/statusLine references, fragile local marketplaces, duplicate components, malformed JSON, orphaned files. Read-only: it reports, it fixes nothing.
argument-hint: "[config dir, optional]"
---

Run a **read-only config audit** of the Claude Code setup and report the drift. The
facts come from a deterministic collector (it reads the config files — no guessing);
your job is to run it and present what it found.

1. Run the collector. If `$ARGUMENTS` names a config dir, pass it; otherwise let the
   script resolve it (`$CLAUDE_CONFIG_DIR`, else `~/.claude`):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/config-audit.js" --json
   ```
   Append `--dir "$ARGUMENTS"` only if `$ARGUMENTS` is non-empty.
2. Parse the JSON `{ summary, findings }`. Each finding has `severity`
   (`error` | `warning` | `info`), `category`, `title`, `detail`, `fix`, `evidence`.
3. Present them grouped by severity, **errors first**, terse — no preamble:
   ```
   CONFIG AUDIT — <E> errors · <W> warnings · <I> info

   ERRORS — break things now
     <title> — <detail>
       fix: <fix>   [<evidence>]
   WARNINGS — fragile / silent failures
     ...
   INFO — cleanup candidates
     ...
   ```
   If there are zero findings, say `clean — no drift detected` and stop.
4. **Do not modify anything.** This command is detect-only. If the user wants a fix
   applied, say it's their call and they can do it by hand — automatic fixing is a
   separate, opt-in step, not this command.
