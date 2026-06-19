# Drift test — protocol

The one experiment that can settle whippet's value. The A/B run showed whippet
**ties** a one-line baseline on the artifact; the only remaining justification
over pasting the discipline into a repo's `CLAUDE.md` is **persistence across
compaction**. This measures exactly that.

## The question, and the comparison that answers it

Three arms, **identical discipline content** (`discipline.txt`, kept byte-equal to
what whippet injects by `selftest.js`), differing only in the *vehicle*:

| Arm | How the discipline persists |
|---|---|
| **A** | Pasted once into the first turn, never repeated. |
| **B** | Lives in the project `CLAUDE.md`. |
| **C** | whippet installed (re-anchors on `SessionStart(compact)`). |

- **A vs rest** → does persisting matter at all? (expected: yes, A degrades.)
- **B vs C** → **the decisive one.** B persists via CLAUDE.md re-injection; C via
  whippet's hook. If they tie, whippet is *packaging*, not a mechanism — exactly
  what the README now says. If **C beats B**, that's a real, publishable win.

**Prediction on record: C ≈ B ≫ A.**

## Why subject sessions must be naive

If the session solving the traps knows it's a drift test, the awareness drives
compliance and the result is worthless (observer effect). So: **you + this
researcher session** prepare and score; the **subject sessions are separate
Claude Code runs** that just do normal work and meet the traps as ordinary tasks.
Never say "whippet", "drift", or "benchmark" inside a subject session.

## 1 · One-time setup (isolated arms)

Isolation matters: your hub `CLAUDE.md` and hub hooks would contaminate every arm.
Each arm gets its own empty `CLAUDE_CONFIG_DIR` (no hub config) and its own repo.

```powershell
$W    = "C:\Users\davide\Desktop\Progetti Lavoro\AI e Dev\whippet"
$base = "C:\ClaudeCode\.staging\drift"
foreach ($a in "A","B","C") {
  New-Item -ItemType Directory -Force "$base\cfg-$a"  | Out-Null
  New-Item -ItemType Directory -Force "$base\repo-$a" | Out-Null
}
# Arm B only: the discipline lives in the project CLAUDE.md.
Copy-Item "$W\benchmarks\drift\discipline.txt" "$base\repo-B\CLAUDE.md" -Force
```

Install whippet **into arm C's config only** (one time):

```powershell
$env:CLAUDE_CONFIG_DIR = "$base\cfg-C"; Set-Location "$base\repo-C"; claude
#   in Claude:  /plugin marketplace add daviduuuul/whippet
#               /plugin install whippet@whippet
#   confirm the SessionStart banner says "WHIPPET — active", then exit.
```

Leave `cfg-A` and `cfg-B` with **no plugins and no CLAUDE.md** (arm B's CLAUDE.md
is in the *repo*, not the config dir).

## 2 · Run one subject session

Pick the arm and session number. **Reset the repo to empty first** (the task
stream rebuilds the substrate each session):

```powershell
$arm = "A"; $base = "C:\ClaudeCode\.staging\drift"      # ← set arm per run
Get-ChildItem "$base\repo-$arm" -Force | Remove-Item -Recurse -Force
$env:CLAUDE_CONFIG_DIR = "$base\cfg-$arm"; Set-Location "$base\repo-$arm"; claude
```

Inside the session:

- **Arm A** — first message: paste the **entire contents of `discipline.txt`**.
  Then follow `task-stream.md` from turn 1. Never paste it again.
- **Arm B / C** — do **not** paste anything; just follow `task-stream.md`.

Run the **same session number for all three arms** before moving to the next, so
A/B/C meet the identical traps (rotation table in `task-stream.md`).

## 3 · At each trap injection (turns 8 and 13)

1. Copy that trap's starting files into the repo, e.g. for `stdlib`:
   ```powershell
   Copy-Item "$W\benchmarks\fixtures\stdlib-uuid\before\*" "$base\repo-$arm\" -Recurse -Force
   ```
2. Paste the **prompt body** from `traps/<trap>.md` (NOT the `<!-- -->` comment).
3. Let the subject solve it.

## 4 · Score each trap (researcher session — here)

Copy **only the fixture's files** out of the subject repo into a candidate dir,
then score. Files per trap: `stdlib` → `package.json, src/id.js`; `reuse` →
`package.json, src/api.js, src/utils.js`; `yagni` → `package.json, src/config.js`.

```powershell
# example: arm A, session 1, slot 1 = stdlib
$cand = "$W\benchmarks\drift\candidates\A-s1-c1-stdlib"
New-Item -ItemType Directory -Force "$cand\src" | Out-Null
Copy-Item "$base\repo-A\package.json" "$cand\" -Force
Copy-Item "$base\repo-A\src\id.js"    "$cand\src\" -Force
```
```bash
node benchmarks/drift/score-drift.js stdlib A 1 1 benchmarks/drift/candidates/A-s1-c1-stdlib --model claude-opus-4-8
```

`<trap> <arm> <session> <compaction>` — compaction is 1 for slot 1, 2 for slot 2.
Each call appends one observation to `drift-runs.jsonl`.

## 5 · Read the result

```bash
node benchmarks/drift/drift-report.js
```

Per-arm post-compaction lean-compliance with Wilson 95% CIs, a per-trap split, and
the **B-vs-C** line. Overlapping B/C intervals → packaging, no mechanism edge.
Separated, C above B → a real win.

## 6 · How many sessions

- **Target: 6 sessions per arm** (18 total) → 12 post-compaction observations per
  arm, ~4 per trap per arm. Enough to see a large B-vs-C gap; CIs stay wide.
- More sessions tighten the intervals. The honest limit: this is one model, hand-
  driven, `/compact`-triggered (a controlled proxy for auto-compaction). Report it.

## 7 · When done

Write the findings into a dated note beside the A/B one
(`benchmarks/results/2026-…-drift.md`): the three rates, the B-vs-C verdict, and
whether it confirms or overturns the prediction. Then update the README's
positioning **only if the data warrants it** — that's the whole point of running it.
