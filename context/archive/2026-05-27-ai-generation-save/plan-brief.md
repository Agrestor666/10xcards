# AI generation + save — Plan Brief

> Full plan: `context/changes/ai-generation-save/plan.md`

## What & Why

Build the MVP’s north-star flow (S-02): generate flashcards from pasted text with AI, let the user review/edit/delete results, then save accepted cards into a set. This validates the core hypothesis that AI output is good enough to accept with minimal edits, while respecting NFRs (<10s perceived latency, and no storage of source text).

## Starting Point

The app already has Supabase SSR auth + a protected `/dashboard`, plus flashcard set creation/listing (`flashcard_sets`) and DB schema + RLS for `flashcards`. There is no AI integration and no endpoint to insert flashcards yet.

## Desired End State

On `/dashboard`, a signed-in user can paste text → generate Q+A drafts → edit/delete drafts → select an existing set → save, receiving a clear confirmation that \(N\) cards were saved to that set.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Auth gating | Require login for generation + save | Matches current protected-route model and avoids anonymous session handoff edge cases. |
| UI location | Generator section on `/dashboard` | Keeps the north-star path in the main authenticated hub and reuses existing set context. |
| Set selection timing | Choose set at save time | Optimizes first value (see results fast) while still saving to an explicit set. |
| Provider integration | OpenRouter via server `fetch` | Minimal dependencies and works well in Cloudflare Workers SSR. |
| Default model bias | Small/fast model | Best shot at meeting perceived <10s latency NFR; quality can iterate. |
| LLM response contract | Strict JSON array of `{question, answer}` | Enables deterministic validation and safe persistence. |
| Input limits | Hard character limit (client + server) | Prevents slow/timeout-prone requests and keeps UX predictable. |
| Progress UX | Disable submit + show loading state | Meets “ack in 200ms + visible progress” without streaming complexity. |
| Editing | Inline edit question + answer | Load-bearing for trust per PRD FR-005. |
| Save semantics | Save only valid, non-deleted cards; block if none | Predictable behavior with clear user feedback. |
| Deduplication | None in MVP | Avoids false positives; can be handled later in CRUD slice. |
| Post-save next | Confirm + point user to destination set context | Clear feedback loop; set detail route can come later. |

## Scope

**In scope:**

- OpenRouter-backed generation endpoint with strict validation and safe errors
- Dashboard generator UI (paste, generate, preview list, inline edit/delete)
- Bulk insert endpoint to save accepted cards to `flashcards` under RLS
- Clear success + failure states; no source text persistence

**Out of scope:**

- Anonymous generation
- Streaming responses / background jobs
- Deduplication vs existing cards
- Starting a review session after save
- File import

## Architecture / Approach

React island on `/dashboard` manages local draft state. It calls two server API routes:

- `POST /api/ai/generate` → `{ ok, cards }`
- `POST /api/flashcards/bulk-create` → `{ ok, insertedCount }` (or `{ ok:false, message }`)

Both routes validate input with zod, enforce auth via Supabase SSR cookies, and return user-safe errors. Source text is never persisted or logged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server foundations | Env + generate/save endpoints | OpenRouter latency/invalid JSON handling |
| 2. Generator UI | Dashboard paste→preview→edit/delete | UI state complexity, validation UX |
| 3. Save confirmation | User-safe DB error mapping + success UX | RLS permission errors, clarity of feedback |

**Prerequisites:** Supabase schema + RLS applied (F-01) and sets UI present (S-01).

**Estimated effort:** ~2–4 focused sessions across 3 phases.

## Open Risks & Assumptions

- OpenRouter latency must fit the <10s perceived budget on the target Workers plan.
- Models can still return invalid JSON; server must handle it gracefully without leaking text.

## Success Criteria (Summary)

- User can generate, edit/delete, and save cards into a set from `/dashboard`.
- Save respects RLS: users can only insert into their own sets.
- No pasted source text is persisted or exposed in operator-accessible storage.
