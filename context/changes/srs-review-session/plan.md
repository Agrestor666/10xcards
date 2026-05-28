# SRS review session (S-04) Implementation Plan

## Overview

Implement a dedicated SRS review session page for a flashcard set and wire server-side FSRS scheduling (`ts-fsrs`) so that each grading updates `due_at` + `srs_state` under existing RLS.

## Current State Analysis

- Database already supports scheduling storage via `flashcards.due_at` + `flashcards.srs_state` and has an index for due queries (`(set_id, due_at)`), with RLS policies allowing owner-only select/update.
- The set detail page (`/sets/[id]`) loads cards without SRS fields and currently supports CRUD only.
- API routes follow a consistent pattern: zod-validated body, Supabase SSR client, auth via `supabase.auth.getUser()`, then DB mutation and `jsonResponse()`.

### Key Discoveries:

- Storage contract is already defined in schema: `due_at <= now()` is the due filter; `srs_state` is opaque and owned by S-04. (`supabase/migrations/20260526211944_flashcard_schema.sql`)
- Middleware already protects all `/sets/**` routes. (`src/middleware.ts`)
- App types already carry `due_at` and `srs_state` for `Flashcard`. (`src/types.ts`)

## Desired End State

- User can open a review session at `/sets/<id>/review`.
- The page shows one due card at a time (ordered by `due_at ASC`), supports a “Show answer” step, then grading with 4 choices: Again/Hard/Good/Easy.
- Each grading triggers server-side FSRS `next()` and persists the resulting schedule back to `flashcards` (`due_at` + `srs_state`).
- If there are no due cards, the page shows an empty state and the next upcoming due time for the set (if any).

## What We're NOT Doing

- No `scheduler.repeat()` preview (no “predicted next due” shown on buttons).
- No per-user FSRS parameter configuration (use `fsrs()` defaults).
- No `review_logs` persistence table.
- No idempotency keys or server-side session state (`sessionId`); MVP is best-effort with UI disabling.
- No changes to CRUD behavior for question/answer (S-03 ownership); review flow only updates scheduling fields.

## Implementation Approach

- Switch the existing set route to a folder-based dynamic route (`src/pages/sets/[id]/index.astro`) and add a sibling protected review page `src/pages/sets/[id]/review.astro` that loads minimal set metadata and renders a React island for the session UI.
- Implement two API endpoints:
  - `GET /api/srs/due?setId=<uuid>`: returns the next due card (or empty state details).
  - `POST /api/srs/grade`: grades a card with a `rating` and persists the updated schedule.
- Keep all FSRS logic server-side. Create a small mapper layer converting DB row (`due_at` ISO + `srs_state` JSON) into `ts-fsrs` `Card` (Date fields) and back.
- Use `fsrs()` default parameters and map rating to `ts-fsrs` `Rating` enum.

## Phase 1: Add FSRS scheduling core (server-side)

### Overview

Introduce `ts-fsrs`, define the DB↔FSRS card mapping, and provide a single “grade card” service function that returns updated schedule fields.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Add the scheduling library used by S-04.

**Contract**: `ts-fsrs` is available to server modules and API routes.

#### 2. Scheduler + mapper

**File**: `src/lib/srs/scheduler.ts` (new)

**Intent**: Provide a single place to create the FSRS scheduler instance.

**Contract**: Exports a `scheduler` (from `fsrs()`) used by API/service code (defaults only).

**File**: `src/lib/srs/fsrs-mapper.ts` (new)

**Intent**: Convert persisted `flashcards` row fields into `ts-fsrs` `Card`, and convert results back into `{ due_at, srs_state }`.

**Contract**:
- Input: `{ due_at: string; srs_state: Record<string, unknown> }` (plus `now: Date` for fallback).
- Output for scheduling: a `Card` with `due: Date` and other numeric fields.
- Output for persistence: `{ due_at: string; srs_state: Record<string, unknown> }` with `due_at` as ISO string.

#### 3. Grade service

**File**: `src/lib/srs/grade-card.ts` (new)

**Intent**: Centralize the grading logic used by the API route to ensure consistent behavior and easy testing.

**Contract**:
- Input: persisted card state (`due_at`, `srs_state`), `now`, and a `rating` (Again/Hard/Good/Easy).
- Output: next persisted schedule fields `{ due_at, srs_state }`.
- Uses `scheduler.next()` only (no preview).

### Success Criteria:

#### Automated Verification:

- Type-check passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Local import of `ts-fsrs` works in the worker runtime (no bundling/runtime errors) when hitting an API route that imports the new modules.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API endpoints for due fetch + grading persistence

### Overview

Expose server functionality needed by the review UI: fetch the next due card for a set and persist schedule updates after grading.

### Changes Required:

#### 1. Due card endpoint

**File**: `src/pages/api/srs/due.ts` (new)

**Intent**: Return the next due card (ordered by `due_at ASC`) for a given set, scoped to the signed-in user via RLS.

**Contract**:
- Method: `GET`
- Query: `setId: uuid`
- Query parsing: `const url = new URL(context.request.url); const rawSetId = url.searchParams.get("setId")`. If missing/invalid UUID → `400` with `{ ok: false, message: "Invalid request." }` (or the repo-standard `"Invalid request body."` equivalent for query).
- Response:
  - `{ ok: true, kind: "due", card: { id, question, answer } }` when a due card exists
  - `{ ok: true, kind: "empty", nextDueAt: string | null }` when no due cards exist
  - `{ ok: false, message: string }` for auth/validation errors
- DB behavior:
  - Due query: `eq(set_id, setId) AND lte(due_at, now) ORDER BY due_at ASC LIMIT 1`
  - Next due query (for empty state): `eq(set_id, setId) ORDER BY due_at ASC LIMIT 1` and take `due_at` (can be `null` if no cards at all)

#### 2. Grade endpoint

**File**: `src/pages/api/srs/grade.ts` (new)

**Intent**: Apply a rating to the current card and persist updated schedule (`due_at`, `srs_state`) server-side.

**Contract**:
- Method: `POST`
- Body: `{ cardId: uuid, rating: "again" | "hard" | "good" | "easy" }`
- Response:
  - `{ ok: true, updated: { id, due_at } }` on success
  - `{ ok: false, message: string }` on failure
- DB behavior:
  - Read card by `id` to get `set_id`, `due_at`, `srs_state` (RLS scoped).
  - Compute next schedule with grade service.
  - Update card: set `due_at`, `srs_state`, `updated_at = nowIso`.
- Double-submit handling (MVP): UI disables buttons after click; server is best-effort and does not dedupe.

#### 3. Endpoint conventions

**Files**: `src/pages/api/srs/due.ts`, `src/pages/api/srs/grade.ts`

**Intent**: Match existing API conventions for auth + error responses.

**Contract**:
- `export const prerender = false`
- Create Supabase SSR client via `createClient(context.request.headers, context.cookies)`
- Require signed-in user via `supabase.auth.getUser()`
- Validate inputs with zod; invalid body/query returns 400; missing auth returns 401; missing supabase returns 503.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- For a set with a due card: `GET /api/srs/due?setId=...` returns that card.
- After `POST /api/srs/grade` with rating, the card’s `due_at` changes and the same card no longer appears as due (unless the scheduler sets due to now).
- For a set with no due cards: `GET /api/srs/due?setId=...` returns `kind: "empty"` and `nextDueAt` matches the soonest upcoming card (or `null` if the set is empty).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Review session page + React island UI

### Overview

Add a dedicated review page under the set and implement the step-based UI flow: question → reveal answer → grade.

### Changes Required:

#### 1. Route structure update + new page route

**File**: `src/pages/sets/[id].astro` → `src/pages/sets/[id]/index.astro` (rename)

**Intent**: Adopt a consistent folder-based routing structure under `sets/[id]/...` so adding `review.astro` does not introduce a one-off routing convention.

**Contract**: `/sets/<id>` continues to resolve to the set detail page with identical behavior.

**File**: `src/pages/sets/[id]/review.astro` (new)

**Intent**: Serve the review session page for a set, protected by existing `/sets` route gate.

**Contract**:
- SSR loads set metadata (id + name) and renders a React island with `setId` + `setName`.
- Provides a “Back to set” link.

#### 2. Review session island

**File**: `src/components/srs/ReviewSession.tsx` (new)

**Intent**: Implement the session UX with minimal state and best-effort request safety.

**Contract**:
- On mount: call `GET /api/srs/due?setId=...`
- UI states:
  - Loading
  - Due card: show question, then “Show answer”, then 4 rating buttons
  - Empty state: “No cards due” + next due time (if present) + link back to set
  - Error state: show message and allow retry
- After grading: disable buttons while saving; on success refetch next due card.

#### 3. Navigation entry point

**File**: `src/pages/sets/[id].astro` and/or `src/components/flashcards/SetFlashcardsManager.tsx`

**Intent**: Provide a clear way to start a review session from a set.

**Contract**:
- Add a “Start review” button/link that navigates to `/sets/<id>/review`.
- Keep CRUD UI unchanged.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- From `/sets/<id>` user can open `/sets/<id>/review`.
- The flow matches: question → show answer → select rating.
- After rating, the next due card loads (or empty state).
- Empty state displays the next due time when present.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

Note: This repo currently has no dedicated test runner scripts; for S-04 MVP the automated gate is `npm run build` + `npm run lint`. Any unit/integration tests are optional hardening work and may be deferred.

### Unit Tests:

- Mapper roundtrip: DB shape → FSRS `Card` → persisted shape (especially date parsing/serialization and `{}` defaults).
- Grading service: `{}` initial state behaves (maps to `createEmptyCard(now)`), and produces a valid persisted update for each rating.

### Integration Tests:

- Due endpoint: due card vs empty state, requires auth.
- Grade endpoint: updates `due_at` and `srs_state` and respects RLS.

### Manual Testing Steps:

1. Create a set and a few cards; confirm new cards show as due immediately (default `due_at=now()`).
2. Start review session; grade a card “Good”; confirm it disappears from due list.
3. Repeat until empty; confirm empty state and next due time (or none).
4. Try to hit endpoints while signed out; confirm 401.

## Performance Considerations

- Due query is indexed (`flashcards_set_id_due_at_idx`), so fetching next due card is \(O(\log n)\) per set.
- Keep payload minimal (no preview variants).

## References

- Research: `context/changes/srs-review-session/research.md`
- FSRS docs: `context/changes/srs-review-session/ts-fsrs.md`
- Schema + RLS: `supabase/migrations/20260526211944_flashcard_schema.sql`
- API patterns: `src/pages/api/flashcards/create.ts`, `src/pages/api/flashcards/update.ts`, `src/lib/api-json.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Add FSRS scheduling core (server-side)

#### Automated

- [x] 1.1 `npm run build` (type-check) — f186d96
- [x] 1.2 `npm run lint` — f186d96

#### Manual

- [x] 1.3 Hit an API route importing SRS modules without runtime errors — f186d96

### Phase 2: API endpoints for due fetch + grading persistence

#### Automated

- [x] 2.1 `npm run build` (type-check)
- [x] 2.2 `npm run lint`

#### Manual

- [x] 2.3 `GET /api/srs/due?setId=...` returns due/empty correctly — 5ee27c5
- [x] 2.4 `POST /api/srs/grade` updates `due_at` + `srs_state` and advances session — 5ee27c5

### Phase 3: Review session page + React island UI

#### Automated

- [x] 3.1 `npm run build` (type-check) — ad07644
- [x] 3.2 `npm run lint` — ad07644

#### Manual

- [x] 3.3 Full session flow: show answer → rate → next card / empty state — ad07644
