# config-audit — real-world validation (45 public `.claude/settings.json`)

The `corpus.json` eval uses *realistic synthetic* configs. This pass runs config-audit against
**45 real `.claude/settings.json` files** found on public GitHub (via code search across diverse
repos) to measure the false-positive rate on configs real developers actually committed.

**Scope:** only the content checks are scored (settings / permissions / hooks / mcp / statusline /
config), excluding the filesystem-dependent `script missing` check — the same in-scope set as the
synthetic eval, since we only have the settings.json, not the repo's hook scripts or plugin tree.

## Result

| | configs | content findings |
|---|---|---|
| **clean (0 findings)** | **42 / 45** | — |
| with findings | 3 / 45 | 12 (all "malformed permission rule") |

**Every one of the 12 findings is a TRUE POSITIVE** — a genuinely broken rule, verified against the
authoritative permission-rule syntax (`code.claude.com/docs/en/permissions`):

- **nicolargo/glances** (9): deny rules written as `"Read: .venv-uv/**"` — the colon-space form.
  The valid syntax is `Read(...)`; a top-level colon is only valid as `Tool(param:value)` *inside*
  parentheses. These deny rules silently do nothing — the author's intent to block reads of
  `.venv-uv`, `node_modules`, `.git`, etc. is not enforced.
- **lintel-rs/lintel** (1): `"mcp__rust-analyzer*"` in `allow`. An allow glob must be anchored with
  a `mcp__<server>__` prefix (e.g. `mcp__rust-analyzer__*`); an unanchored glob is "skipped with a
  warning and does not auto-approve anything." The intended whole-server allow does not take effect.
- **depictio/depictio** (2): `"SlashCommand:*"` and `"Plugin:*"` — the top-level colon form, which
  is not valid rule syntax (the bare tool name `SlashCommand` or `SlashCommand(...)` is the form).

## Reading

**Zero false positives on 45 real configs** — config-audit flagged nothing valid. And beyond
precision, it demonstrated real value: it caught genuinely-broken permission rules in 3 public
repos that the schema and a `CLAUDE.md` paste cannot — rules that are valid JSON but silently fail
at runtime, exactly the drift this engine exists to surface. No engine change needed.

Reproduce with the `config-audit-realworld` workflow (GitHub code search → `config-audit --json` →
keep content-category findings). The synthetic-corpus eval (96.5% recall, 0 real FP) and this
real-world pass agree: the precision holds in the wild.
