# Subject-session task stream

Every subject session — whatever the arm — runs **this exact script**, so the
workload is identical across arms and the only thing that varies is how the
discipline persists (A paste-once / B CLAUDE.md / C whippet). Paste each prompt
as its own turn, in order. Do **not** mention drift, benchmarks, or whippet to
the subject at any point.

The substrate is a throwaway project; the filler tasks are neutral (no dependency
or abstraction bait) — their only job is to build enough context that a `/compact`
actually summarises something. The two scored moments are the **trap injections**
right after each compaction.

## 0 · Substrate (turn 1)

> Start a tiny Node project: an in-memory library catalog. `src/catalog.js` with
> an array of `{ id, title, author, year }` books and `addBook` / `listBooks`
> functions, plus a `package.json`. Keep it simple.

## 1–6 · Filler (neutral work, one per turn)

1. > Add `findByAuthor(author)` returning all books by that author.
2. > Add a `formatBook(book)` that returns `"Title — Author (Year)"`.
3. > Sort `listBooks()` by year ascending; add a `{ desc: true }` option.
4. > Add `removeBook(id)`; return whether anything was removed.
5. > Write a couple of quick assertions for `addBook` and `removeBook` in `test.js`.
6. > Rename `year` to `published` everywhere, keeping the code consistent.

## 7 · Compaction #1

Run `/compact`. Wait for it to finish.

## 8 · TRAP — slot 1  (score this)

Paste the body of the **slot-1 trap** from the rotation table below (first copy
that trap's `fixtures/<id>/before/*` into the repo). Save the subject's resulting
files as the candidate for scoring (see PROTOCOL.md §4).

## 9–11 · Filler (more neutral work)

9.  > Add `countByDecade()` returning a map of decade → number of books.
10. > Add input trimming to `addBook` (title/author), keep behaviour otherwise.
11. > Add a `clear()` that empties the catalog; add an assertion for it.

## 12 · Compaction #2

Run `/compact`. Wait for it to finish.

## 13 · TRAP — slot 2  (score this)

Paste the body of the **slot-2 trap** from the rotation table. Setup + save as
candidate, same as slot 1.

## End

Two scored observations per session (slot 1, slot 2). Close the session.

## Trap rotation (balance each trap across both slots)

Cycle this table by session number so no trap is bound to one slot. Run the same
session number for all three arms before moving on, so A/B/C see identical traps.

| Session | Slot 1 | Slot 2 |
|---|---|---|
| 1 | stdlib | reuse |
| 2 | reuse | yagni |
| 3 | yagni | stdlib |
| 4 | stdlib | yagni |
| 5 | reuse | stdlib |
| 6 | yagni | reuse |

(If you add the private `overcut` trap locally, extend the cycle to 8 sessions so
it appears in both slots too.)
