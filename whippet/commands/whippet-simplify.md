---
description: Apply whippet's lean discipline to the current changes — delete what's dead, reuse what exists, swap a dependency for the platform, tighten the rest, and never cut a guard.
argument-hint: "[path or commit range, optional] [--lite|--ultra]"
---

The **whippet** simplify pass — not a beautifier, a discipline. Make the current
changes the least code that still holds, then prove it still holds. Scope:
`$ARGUMENTS` if a path/range is given, else the working diff (staged + unstaged).
If nothing changed, say so and stop. If the session is `stop whippet`, say so and
don't apply.

## 1. Read the change

`git diff --staged` and `git diff` (or the range in `$ARGUMENTS`). Work only on
code touched here unless told otherwise. Match the surrounding language and its
conventions — no imported idioms, no reformatting untouched lines.

## 2. Find the cuts

For each hunk, look for:

- **Dead / removable** — code, files, branches, or exports nothing needs (YAGNI).
- **Reinvented** — logic the standard library, a native platform feature, or
  existing repo code already covers. Name the existing symbol.
- **Redundant dependency** — a new dep doing what a few lines, the platform, or an
  already-installed package does; a duplicate or overlapping library.
- **Premature abstraction** — an interface, factory, wrapper, or config with one caller.
- **Needless indirection** — a pass-through, a variable used once, nesting that
  flattens, a comment that just restates the code.

## 3. Apply — only what is safe

Apply the cuts that are **behavior-preserving and high-confidence**. Anything that
could change behavior, or that you're unsure about, you do **not** edit — list it
as a flag (step 5) for the human. Prefer the smallest edit that lands the win.
Clarity beats golf: never trade a readable line for a dense one-liner or a nested
ternary.

## 4. Never cut a guard — this is the line

These are not simplification targets, ever. If shrinking the diff would remove one,
**stop and flag it as a regression** instead of applying it:

- validation of untrusted input, and the error handling that prevents data loss
- security — and security primitives (hashing, crypto, auth) stay a vetted library, never hand-rolled
- accessibility, and resource release / disposal
- the one runnable check that proves break-able logic still works

After applying, make sure changed logic still has a runnable check; run it if it's
cheap and report the result. Leave the tree clean — no scratch files, no
commented-out blocks, no half-applied edits.

## 5. Report — terse, lead with the result

- **Applied:** `file:line — what changed` (most impactful first).
- **Flagged (left for you):** `file:line — why it's risky`.
- One-line verdict: `simplified` / `already lean` / `flags need a human`.

No essay, no restating the request. With `--json` in `$ARGUMENTS`, output only
`{ "applied": [{file, line, change}], "flagged": [{file, line, risk}], "verdict": "…" }`
and nothing else.

## Levels

Default is the session mode (`full`). `--lite`: only the obvious, zero-risk cuts.
`--ultra`: delete-first — push back on whether the code should exist at all before
tightening what's left.
