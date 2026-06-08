# Manual flashcard CRUD (S-03) Implementation Plan

## Overview

Implement post-save flashcard management: a logged-in user opens a set detail page, manually adds cards, edits question/answer inline, and deletes cards with confirmation. Backed by JSON API routes and a shared React card row component designed for reuse by S-02's AI generator preview.

## Current State Analysis

- **Schema + RLS ready:** `public.flashcards` supports insert/update/delete with ownership enforced via set membership (`supabase/migrations/20260526211944_flashcard_schema.sql`).
- **Sets index exists:** `/dashboard` lists sets and creates new ones (`src/pages/dashboard.astro`, `src/pages/api/flashcard-sets/create.ts`) but set names are not linked anywhere.
- **Partial card write path:** `POST /api/flashcards/bulk-create` inserts multiple cards for AI save flow (`src/pages/api/flashcards/bulk-create.ts`); no single-card create, update, or delete routes.
- **Validation reusable:** `validateFlashcardDrafts()` and `MAX_CARD_FIELD_CHARS` in `src/lib/flashcard-draft-validation.ts` / `src/lib/ai-generation-limits.ts` cover trim + length rules.
- **No set detail UI:** S-01 explicitly deferred `/sets/<id>`; S-02 generator React island is not built yet — this slice introduces the shared card row first.

## Desired End State

A signed-in user can:

1. Click a set name on `/dashboard` and land on `/sets/<id>`.
2. See the set name and all saved cards (question + answer) in a list.
3. Add a card via an inline form at the top (non-empty question + answer required).
4. Edit any card inline and save changes; the list reflects updates immediately.
5. Delete a card after confirming; the card disappears from the list.
6. See inline success/error messages for all mutations (no page redirect).

Verification: cards persist in Supabase under RLS; another user's set/cards are inaccessible; lint + build pass.

### Key Discoveries:

- JSON API convention established: zod parse → business validation → `{ ok: true }` / `{ ok: false, message }` via `jsonResponse()` (`src/lib/api-json.ts`, `src/pages/api/flashcards/bulk-create.ts`).
- HTML form + redirect pattern used only for set creation; card mutations fit the JSON pattern better given React island state.
- `Flashcard` type already defined in `src/types.ts` with SRS fields — update/delete must touch only `question` and `answer`, leaving `srs_state` and `due_at` unchanged.
- Middleware protects only `/dashboard` today (`src/middleware.ts`); `/sets/*` must be added.

## What We're NOT Doing

- Set rename or set delete (out of S-03 scope).
- AI generation UI (S-02) — only extract a shared `FlashcardRow` component S-02 can adopt later.
- SRS review session (S-04).
- Soft delete / undo for deleted cards.
- Card reordering or drag-and-drop.
- Per-set card count limits beyond existing field length limits.
- Automated test harness (repo has none for MVP).

## Implementation Approach

- Add three flat JSON API routes (`create`, `update`, `delete`) mirroring bulk-create auth, zod, and error-mapping patterns.
- Extract `FlashcardRow` as a mode-aware presentational component (`persisted` vs `draft`) so S-02 can reuse it without duplicating inline-edit markup.
- Build `/sets/[id].astro` as SSR shell (set metadata, auth gate, card query) with a `SetFlashcardsManager` React island handling all interactive CRUD state and `fetch` calls.
- Link set names from `/dashboard` to the new detail page; extend middleware to protect `/sets`.

## Phase 1: API routes + validation helpers

### Overview

Add server endpoints for single-card create, update, and delete with shared validation and user-safe error mapping.

### Changes Required:

#### 1. Single-card validation helper

**File**: `src/lib/flashcard-draft-validation.ts`

**Intent**: Provide a single-card validator with CRUD-appropriate error messages (distinct from bulk/AI "no valid cards" wording).

**Contract**:
- Export `validateFlashcardDraft(raw: FlashcardDraft): { ok: true; card: FlashcardDraft } | { ok: false; error: string }`
- Trim both fields; reject if either empty after trim with message like "Both question and answer are required."
- Enforce `MAX_CARD_FIELD_CHARS` per field (same limit as bulk path)

#### 2. Flashcard mutation error mapping

**File**: `src/lib/flashcard-errors.ts`

**Intent**: Centralize user-safe error strings for update and delete, matching existing bulk-create mapper.

**Contract**:
- Export `flashcardUpdateErrorMessage(error: { code?: string }): string`
- Export `flashcardDeleteErrorMessage(error: { code?: string }): string`
- Map Postgres `42501` to permission-specific messages; generic fallback otherwise
- Do not expose raw DB/policy details

#### 3. Single-card create API

**File**: `src/pages/api/flashcards/create.ts` (new)

**Intent**: Insert one flashcard into an owned set.

**Contract**:
- `export const prerender = false`
- `POST` JSON body: `{ setId: string (uuid), question: string, answer: string }`
- Auth: `createClient` + `getUser()` → 401 if missing
- Validate with zod + `validateFlashcardDraft`
- Insert `{ set_id, question, answer }` — do not accept `user_id` from client
- Success: `{ ok: true, card: { id, set_id, question, answer, due_at, created_at, updated_at } }` (select inserted row or map from insert return)
- Errors: 400 validation, 403 RLS/permission via `flashcardBulkCreateErrorMessage` or dedicated create mapper, 503 if Supabase unconfigured

#### 4. Flashcard update API

**File**: `src/pages/api/flashcards/update.ts` (new)

**Intent**: Update question and answer of an existing card the user owns (via RLS).

**Contract**:
- `POST` JSON body: `{ id: string (uuid), question: string, answer: string }`
- Auth + zod + `validateFlashcardDraft` same as create
- `supabase.from("flashcards").update({ question, answer }).eq("id", id).select(...).single()`
- Success: `{ ok: true, card: { ... } }`
- Errors: 403 on RLS failure via `flashcardUpdateErrorMessage`; 404-style message if no row returned (card not found or not owned)

#### 5. Flashcard delete API

**File**: `src/pages/api/flashcards/delete.ts` (new)

**Intent**: Hard-delete a flashcard by id; RLS ensures ownership.

**Contract**:
- `POST` JSON body: `{ id: string (uuid) }`
- Auth required
- `supabase.from("flashcards").delete().eq("id", id)`
- Success: `{ ok: true }`
- Errors: 403 via `flashcardDeleteErrorMessage`; user-safe message if delete affects zero rows

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Authenticated POST to `/api/flashcards/create` with valid payload inserts a row visible in Supabase.
- Update changes question/answer without altering `srs_state` or `due_at`.
- Delete removes the row; repeating delete returns a user-safe error.
- Requests against another user's set/card id return permission-safe errors (no SQL leakage).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shared FlashcardRow component

### Overview

Extract a reusable inline card row for persisted and draft modes so S-03 and future S-02 share one edit/delete UI.

### Changes Required:

#### 1. FlashcardRow component

**File**: `src/components/flashcards/FlashcardRow.tsx` (new)

**Intent**: Render one card's question/answer fields with mode-specific actions.

**Contract**:
- Props (minimum):
  - `mode: "persisted" | "draft"`
  - `question: string`, `answer: string`
  - `onQuestionChange`, `onAnswerChange`
  - For `persisted`: `onSave`, `onDelete`, `isSaving`, `isDeleting`, `saveError?`
  - For `draft`: `onRemove` (no save — draft is client-only until bulk save in S-02)
- UI: two text inputs/areas (question, answer), character hint optional (max 2000)
- Delete in `persisted` mode: two-step confirm (Delete button → Confirm/Cancel inline)
- Styling: match cosmic dashboard theme (glass panels, white/purple text) using `cn()` from `@/lib/utils`

#### 2. SetFlashcardsManager island

**File**: `src/components/flashcards/SetFlashcardsManager.tsx` (new)

**Intent**: Own all client state for listing, adding, editing, and deleting cards on the set detail page.

**Contract**:
- Props: `setId: string`, `setName: string`, `initialCards: Array<Pick<Flashcard, "id" | "question" | "answer" | "updated_at">>`
- State: `cards`, add-form fields, per-row saving/deleting flags, global `bannerMessage` (success/error)
- Add form at top: question + answer + "Add card" button; calls `POST /api/flashcards/create`; prepends returned card to list on success
- Each row: `FlashcardRow` in `persisted` mode; Save calls `POST /api/flashcards/update`; Delete calls `POST /api/flashcards/delete` after confirm
- Inline feedback: show success/error banner within the island (auto-clear success after a few seconds optional)
- Disable actions while a request is in flight for that row

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Component renders a list of cards with editable fields.
- Add form validation blocks empty fields client-side before calling API.
- Delete requires confirmation before firing the delete request.
- Save/update reflects new text without full page reload.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Set detail page + dashboard navigation

### Overview

Wire the set detail route, server data loading, and navigation from the sets index.

### Changes Required:

#### 1. Set detail Astro page

**File**: `src/pages/sets/[id].astro` (new)

**Intent**: Server-render set context and hydrate the CRUD island.

**Contract**:
- Read `id` from `Astro.params`; validate UUID format — redirect to `/dashboard?error=Invalid set` if malformed
- Query `flashcard_sets` for `id, name` (RLS scopes to owner); if missing → redirect `/dashboard?error=Set not found`
- Query `flashcards` where `set_id = id`, select `id, question, answer, updated_at`, order by `created_at` ascending (or `updated_at` desc — pick one and stay consistent)
- Render header: set name, back link to `/dashboard`
- Mount `<SetFlashcardsManager client:load setId={...} setName={...} initialCards={...} />`
- Match dashboard layout/styling (`Layout`, cosmic theme)

#### 2. Dashboard set links

**File**: `src/pages/dashboard.astro`

**Intent**: Make each set name navigable to its detail page.

**Contract**:
- Wrap set name in `<a href={/sets/${set.id}}>` with hover/focus styles consistent with theme
- Keep updated date as secondary metadata

#### 3. Protect `/sets` routes

**File**: `src/middleware.ts`

**Intent**: Require authentication for set detail pages.

**Contract**:
- Add `"/sets"` to `PROTECTED_ROUTES` (prefix match already used)

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- From `/dashboard`, clicking a set opens `/sets/<id>` with correct name and cards.
- Invalid or foreign set id redirects safely to dashboard with error.
- Unauthenticated access to `/sets/<id>` redirects to sign-in.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Hardening + edge cases

### Overview

Polish empty states, loading edge cases, and verify RLS isolation end-to-end.

### Changes Required:

#### 1. Empty state on set detail

**File**: `src/components/flashcards/SetFlashcardsManager.tsx`

**Intent**: When a set has zero cards, show helpful copy above the add form (add form remains primary CTA).

**Contract**:
- Message like "No cards yet. Add your first one below." when `cards.length === 0`
- Add form still visible at top per product decision

#### 2. Concurrent edit guard (lightweight)

**File**: `src/components/flashcards/SetFlashcardsManager.tsx`

**Intent**: Prevent double-submit on Save/Add while request is in flight.

**Contract**:
- Disable Save/Add/Delete buttons per row (or globally for add) while awaiting response
- No optimistic locking / version columns for MVP

#### 3. Touch parent set `updated_at` (optional polish)

**File**: `src/pages/api/flashcards/create.ts` (and update/delete if desired)

**Intent**: Keep dashboard set ordering meaningful when cards change.

**Contract**:
- After successful card mutation, update `flashcard_sets.updated_at` for the parent set (trigger may not exist — explicit `.update({ updated_at: new Date().toISOString() })` on the set row if needed)
- Skip if a DB trigger already maintains this; verify in migration first

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Empty set shows empty state + working add form.
- User A cannot view or mutate User B's set via URL guessing.
- After adding/editing/deleting a card, set appears with fresh `updated_at` on dashboard (if polish included).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `validateFlashcardDraft()` — empty fields, whitespace-only, over-length, happy path trim.
- Error mappers — `42501` and fallback strings.

### Integration Tests:

- Not required for MVP (no test runner); manual API checks via browser devtools or curl suffice.

### Manual Testing Steps:

1. Sign in as User A → create set "Biology" → open `/sets/<id>`.
2. Add card (Q: "What is DNA?", A: "Genetic material") → appears in list immediately.
3. Edit answer → Save → refresh page → change persisted.
4. Delete card → confirm → card gone after refresh.
5. Sign in as User B → attempt `/sets/<user-a-set-id>` → redirected or error, no data leak.
6. Submit add with empty question → client blocks; server also rejects if bypassed.

## Performance Considerations

- Set detail loads all cards in one query — acceptable for MVP scale (no pagination).
- Per-card save/delete is fine for manual CRUD volumes; no batching needed.

## Migration Notes

- No schema migrations required; RLS policies for update/delete already exist.

## References

- PRD: `context/foundation/prd.md` (FR-006, FR-008, FR-009, US-02)
- Roadmap: `context/foundation/roadmap.md` (S-03)
- Schema + RLS: `supabase/migrations/20260526211944_flashcard_schema.sql`
- Bulk create pattern: `src/pages/api/flashcards/bulk-create.ts`
- S-01 sets UI: `context/changes/flashcard-sets-ui/plan.md`
- S-02 generator (future consumer of FlashcardRow): `context/changes/ai-generation-save/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: API routes + validation helpers

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Build passes: `npm run build`

#### Manual

- [x] 1.3 Create/update/delete API routes work for owned cards
- [x] 1.4 Foreign set/card ids return permission-safe errors
- [x] 1.5 Update does not alter SRS fields

### Phase 2: Shared FlashcardRow component

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [x] 2.3 FlashcardRow renders persisted and draft modes
- [x] 2.4 Add form + inline edit + delete confirm work in island

### Phase 3: Set detail page + dashboard navigation

#### Automated

- [x] 3.1 Lint passes: `npm run lint`
- [x] 3.2 Build passes: `npm run build`

#### Manual

- [x] 3.3 Dashboard links open correct set detail page
- [x] 3.4 Invalid/foreign set id handled safely
- [x] 3.5 Unauthenticated `/sets/*` redirects to sign-in

### Phase 4: Hardening + edge cases

#### Automated

- [x] 4.1 Lint passes: `npm run lint`
- [x] 4.2 Build passes: `npm run build`

#### Manual

- [x] 4.3 Empty set state renders with working add form
- [x] 4.4 RLS isolation verified across two users
- [x] 4.5 Parent set `updated_at` reflects card changes (if implemented)
