# SRS review session (S-04) — Plan Brief

> Full plan: `context/changes/srs-review-session/plan.md`
> Research: `context/changes/srs-review-session/research.md`

## What & Why

Add an SRS review session for a flashcard set so that after each answer the system automatically schedules the next review time (FR-010/FR-011). This is the core “repeat over time” loop of 10xCards.

## Starting Point

We already store SRS scheduling fields in DB (`flashcards.due_at` + `flashcards.srs_state`) and have RLS + an index for due queries. The set detail page currently supports CRUD only and does not run a review flow.

## Desired End State

Users can open `/sets/<id>/review`, review due cards one-by-one (ordered by `due_at ASC`), reveal the answer, then grade with Again/Hard/Good/Easy. Each grading updates `due_at` + `srs_state` via server-side FSRS (`ts-fsrs`), and the session continues until there are no cards due (empty state shows next upcoming due time if any).

## Key Decisions Made

| Decision                       | Choice                                                      | Why (1 sentence)                                   | Source |
| ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------- | ------ |
| SRS library                    | `ts-fsrs` (FSRS-6)                                           | Best fit for TS/Workers, aligns with `srs_state`.  | Research |
| Review route                   | `/sets/<id>/review`                                          | Clean IA, already protected by `/sets` middleware. | Plan |
| Due ordering                   | `due_at ASC`                                                 | Matches SRS intent + uses `(set_id, due_at)` index.| Plan |
| Rating UX                      | Show question → reveal answer → rate                         | Prevents accidental ratings, matches SRS norms.    | Plan |
| API surface                    | `GET /api/srs/due` + `POST /api/srs/grade`                   | Simple contracts and aligns with existing API style.| Plan |
| Preview (`repeat()`)           | Skip in MVP (use `next()` only)                              | Minimal payload/complexity; still satisfies FR-011.| Plan |
| FSRS parameters                | Defaults (`fsrs()`)                                          | Fastest path; no config/migrations needed.         | Plan |
| Double-submit handling         | Best-effort + UI disable                                     | Good MVP tradeoff without extra storage.           | Plan |

## Scope

**In scope:**

- New page: `/sets/<id>/review`
- Fetch next due card and empty state (including next upcoming due time)
- Grade endpoint that updates `due_at` + `srs_state` using FSRS
- React island session UI with reveal-then-rate flow

**Out of scope:**

- `repeat()` preview and showing predicted due dates on buttons
- Per-user FSRS configuration
- Review logs persistence
- Server-side session state / idempotency keys

## Architecture / Approach

Server-centric scheduling: API routes load persisted card state, map it to `ts-fsrs` `Card`, call `scheduler.next()`, then persist the result back to `flashcards`. The UI is a lightweight island that fetches “next due” and posts grades.

## Phases at a Glance

| Phase | What it delivers                              | Key risk |
| ----- | --------------------------------------------- | -------- |
| 1     | `ts-fsrs` + mapper + grade service            | Date serialization/mapping mistakes |
| 2     | `GET due` + `POST grade` endpoints             | RLS/auth edge cases, update correctness |
| 3     | `/sets/<id>/review` page + session UI         | UI state handling (loading/error/empty) |

**Prerequisites:** Supabase configured; schema migration applied; `/sets/<id>` exists (S-01).
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- FSRS date mapping must be consistent (ISO strings in DB, `Date` in FSRS).
- Best-effort double-submit protection is acceptable for MVP; may need optimistic lock later.

## Success Criteria (Summary)

- User can complete a review session and see cards stop appearing once graded (until due again).
- Each grade updates `due_at` + `srs_state` in DB under RLS.
- Empty session clearly communicates “no cards due” and next due time when available.
