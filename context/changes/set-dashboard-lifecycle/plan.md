# Set dashboard lifecycle (S-05) Implementation Plan

## Overview

Expose flashcard set rename and delete on `/dashboard`: inline rename per row, one-click delete for empty sets, and shadcn `AlertDialog` confirmation with card count for non-empty sets. Backed by two new JSON API routes mirroring the existing card mutation pattern; list updates in React state without a full page reload.

## Current State Analysis

- **Dashboard** lists sets read-only (`src/pages/dashboard.astro` L87–101); create uses HTML form POST to `/api/flashcard-sets/create`.
- **Only set API** is create (`src/pages/api/flashcard-sets/create.ts`); no update/delete routes.
- **RLS + cascade ready:** `flashcard_sets` has `update`/`delete` policies; `flashcards.set_id` is `ON DELETE CASCADE` (`supabase/migrations/20260526211944_flashcard_schema.sql`).
- **Name validation** exists: `validateFlashcardSetName` in `src/lib/flashcard-set-name.ts` (1–80 chars, trim).
- **Card mutations** use JSON POST + `jsonResponse` + zod (`src/pages/api/flashcards/update.ts`, `delete.ts`); `SetFlashcardsManager` manages client state.
- **Deleted-set URLs:** `loadSetDetailPage` already redirects to `/dashboard?error=Set not found` when the set row is missing (`src/lib/load-set-detail.ts`).
- **No `alert-dialog` UI** yet; `FlashcardRow` uses inline two-step confirm for cards only.
- **No test runner** in repo (`health-check.md`); verification is lint, build, and manual UI.

## Desired End State

A signed-in user on `/dashboard` can:

1. Click a set name (or Edit) and rename it inline; the list shows the new name immediately after save.
2. Delete an empty set with one action (no confirmation dialog).
3. Delete a set with cards after confirming in a modal that states how many cards will be removed.
4. Open a renamed set at `/sets/<id>` with the updated name; visiting `/sets/<deleted-id>` redirects to dashboard with an error (existing loader behavior).

Verification: only the owner can rename/delete (RLS); create/list sets, card CRUD, SRS, and AI generator behave unchanged; `npm run lint` and `npm run build` pass.

### Key Discoveries:

- `touchFlashcardSetUpdatedAt` only bumps `updated_at` after card changes — rename should set `name` and `updated_at` in the same `update` call.
- `FlashcardGenerator` already uses `client:load` on dashboard — a sibling React island for the set list is consistent.
- Card count for delete copy should be loaded server-side with the list query to avoid an extra round-trip on open.

## What We're NOT Doing

- Rename or delete on `/sets/<id>` (PRD non-goal).
- Soft delete / trash / restore.
- Bulk delete or “delete all empty sets.”
- Blocking delete when cards are due for SRS review.
- Vitest or new CI test stages (out of slice scope).
- Changing create-set form from HTML POST redirect (preserved as-is).

## Implementation Approach

- Add `POST /api/flashcard-sets/update` and `POST /api/flashcard-sets/delete` following card API auth, zod, and `jsonResponse` conventions.
- Extend `flashcard-set-errors.ts` with update/delete mappers (mirror `flashcard-errors.ts`).
- Install shadcn `alert-dialog`; build `SetDashboardList` React island with inline rename, delete (empty vs modal), and client-side list state.
- Extend dashboard SSR query to include per-set `card_count`; pass rows into the island; keep create form and `FlashcardGenerator` unchanged.

## Critical Implementation Details

**Empty vs non-empty delete:** `card_count === 0` → call delete API immediately on Delete click. `card_count > 0` → open `AlertDialog` with copy like “This will permanently delete **N** flashcards and the set **{name}**.” Confirm runs the same delete API.

**Rename inline:** Only one row in edit mode at a time. Save disabled until trimmed name differs and passes 1–80 chars. On API success, patch that row in local state (name + `updated_at` if returned).

## Phase 1: Set update/delete API routes

### Overview

Add authenticated JSON endpoints for renaming and deleting sets, reusing existing validation and error-mapping patterns.

### Changes Required:

#### 1. Set mutation error mappers

**File**: `src/lib/flashcard-set-errors.ts`

**Intent**: Provide user-safe messages for update and delete failures, consistent with create.

**Contract**:
- Export `flashcardSetUpdateErrorMessage(error: { code?: string }): string`
- Export `flashcardSetDeleteErrorMessage(error: { code?: string }): string`
- Map Postgres `42501` to permission-specific copy; generic fallback otherwise

#### 2. Update set name API

**File**: `src/pages/api/flashcard-sets/update.ts`

**Intent**: Accept JSON `{ id, name }`, validate name, update owned row, return updated set metadata.

**Contract**:
- `export const prerender = false`
- Zod body: `{ id: z.uuid(), name: z.string().max(80) }` then `validateFlashcardSetName(name)`
- Auth: `createClient` + `getUser()` → 401 if missing
- Update: `.from("flashcard_sets").update({ name, updated_at: new Date().toISOString() }).eq("id", id).select("id,name,created_at,updated_at").maybeSingle()`
- Responses: `{ ok: true, set }` or `{ ok: false, message }` via `jsonResponse`; 404 if no row; 403 on RLS/DB error via `flashcardSetUpdateErrorMessage`

#### 3. Delete set API

**File**: `src/pages/api/flashcard-sets/delete.ts`

**Intent**: Delete set by id; cascade removes child flashcards at DB level.

**Contract**:
- Zod body: `{ id: z.uuid() }`
- Same auth pattern as update
- Delete: `.from("flashcard_sets").delete().eq("id", id).select("id")`
- 404 if `data.length === 0`; success `{ ok: true }`
- Errors via `flashcardSetDeleteErrorMessage`

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Authenticated `POST` to update with valid name returns `{ ok: true, set }` with new name
- Invalid name (empty / >80) returns 400 with clear message
- Delete returns `{ ok: true }`; set and its cards no longer visible in Supabase for that user
- Unauthenticated or wrong-owner requests return 401/403/404 as appropriate

**Implementation Note**: After automated checks pass, confirm manual API behavior (browser devtools or curl with session cookies) before Phase 2.

---

## Phase 2: Dashboard list island + AlertDialog

### Overview

Add interactive set list UI: inline rename, delete with modal for non-empty sets, and optimistic local list updates.

### Changes Required:

#### 1. Install AlertDialog

**File**: `src/components/ui/alert-dialog.tsx` (via shadcn CLI)

**Intent**: Provide accessible modal for non-empty set delete confirmation per product spec.

**Contract**:
- Run `npx shadcn@latest add alert-dialog` (new-york style, existing project config)
- Use `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`

#### 2. Set list row type

**File**: `src/types.ts` (or colocated type in component if preferred)

**Intent**: Type dashboard list rows including card count for delete copy.

**Contract**:
- Export `DashboardSetRow` (or extend usage): `{ id, name, created_at, updated_at, card_count: number }`

#### 3. SetDashboardList component

**File**: `src/components/sets/SetDashboardList.tsx`

**Intent**: Render “All sets” list with lifecycle actions; manage edit/delete UI state and `fetch` calls.

**Contract**:
- Props: `initialSets: DashboardSetRow[]`
- State: `sets` (initialized from props), `editingId`, `pendingDelete` (set + card count for dialog), `error` banner string
- **Rename:** per row — view mode shows name link to `/sets/{id}`, Edit button; edit mode shows input (maxLength 80), Save/Cancel; Save → `POST /api/flashcard-sets/update` with JSON body; on success update `sets` in state
- **Delete empty:** Delete button → immediate `POST /api/flashcard-sets/delete`; on success remove row from `sets`
- **Delete non-empty:** Delete → open `AlertDialog` with card count and set name; Confirm → delete API; Cancel closes dialog
- Disable actions while a request is in flight for that row
- Use `cn()` for conditional classes; reuse existing button/input styling patterns from `FlashcardRow` / dashboard
- Show inline error text for failed mutations (do not redirect)

#### 4. Optional small presentational helper

**File**: `src/components/sets/SetDashboardRow.tsx` (optional split)

**Intent**: Keep `SetDashboardList` readable if row markup grows.

**Contract**: Only add if the list file exceeds ~200 lines; otherwise keep a single file.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Inline rename: save updates visible name without page reload; cancel restores previous name
- Empty set deletes on first Delete click with no modal
- Non-empty set shows AlertDialog with correct card count; confirm deletes; cancel leaves set
- Error messages appear when API returns `ok: false` (e.g. invalid name)

**Implementation Note**: Confirm manual UI on dashboard before Phase 3 integration polish.

---

## Phase 3: Wire dashboard SSR + regression checks

### Overview

Load card counts server-side, mount the island on `/dashboard`, and verify preserved flows and deleted-set navigation.

### Changes Required:

#### 1. Extend dashboard set query

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch card counts with sets and pass enriched rows to the island.

**Contract**:
- Change select to include embedded count, e.g. `.select("id,name,created_at,updated_at,flashcards(count)")`
- Map Supabase response to `DashboardSetRow[]` (`card_count` from `flashcards[0].count` or `0` if absent)
- Replace static `<ul>` list (L87–101) with `<SetDashboardList client:load initialSets={...} />`
- Preserve empty-state copy when `sets.length === 0` (can live inside island or remain in Astro wrapper — single empty-state UX)

#### 2. Pass sets to FlashcardGenerator

**File**: `src/pages/dashboard.astro`

**Intent**: After rename/delete in island, generator dropdown can become stale until reload.

**Contract**:
- **MVP:** Document that generator `sets` prop is SSR-only on first paint; acceptable for this slice OR lift shared set list state later (out of scope unless trivial)
- If rename/delete should refresh generator options: either full `window.location.reload()` after mutation (conflicts with client_state choice — **do not** use) or pass a minimal callback/event — **prefer:** leave generator as SSR snapshot; user refresh updates dropdown (note in manual test). Optional follow-up: shared context — not in this slice.

**Clarification for implementer:** User chose client_state for the **list** only. Generator dropdown may show old names until page refresh — acceptable per PRD (rename visible on list is primary success criterion).

#### 3. Manual regression checklist (document in PR / impl notes)

**Files**: smoke-test only — no code unless bug found

**Intent**: Confirm guardrails from PRD.

**Contract**:
- Create set still works (HTML form)
- Open renamed set → detail page shows new name
- Deleted set URL → dashboard error (existing `load-set-detail`)
- Card CRUD on another set unchanged
- SRS review and AI generator still load on their routes

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Dashboard shows card counts internally driving delete modal (spot-check: set with 0 vs N cards)
- End-to-end: rename + delete empty + delete non-empty on dashboard
- `/sets/<deleted-id>` redirects with error; renamed set detail works
- No regression on create set, card CRUD, SRS session, AI generate/save

---

## Testing Strategy

### Unit Tests:

- None in repo for MVP; rely on lint/build and manual flows.

### Integration Tests:

- None in CI for this slice.

### Manual Testing Steps:

1. Create two sets; add cards to one only.
2. Rename the non-empty set inline; open `/sets/<id>` — header shows new name.
3. Delete empty set — no dialog; row disappears.
4. Delete non-empty set — dialog shows correct count; confirm removes row.
5. Visit deleted set URL — redirected to dashboard with error.
6. Sign in as another user (if available) — cannot mutate first user's sets via API.
7. Run lint and build locally.

## Performance Considerations

- Single dashboard query with embedded `flashcards(count)` avoids N+1 or per-delete count fetches.
- Client state updates keep the list snappy; no full SSR round-trip per mutation.

## Migration Notes

- No database migration required.

## References

- PRD: `context/foundation/prd-v2.md` (US-01, Scope [new], Non-Goals)
- Shape notes: `context/foundation/shape-notes.md`
- Roadmap: `context/foundation/roadmap.md` (S-05)
- Prior slice patterns: `context/changes/manual-flashcard-crud/plan.md`, `context/changes/flashcard-sets-ui/plan.md`
- Dashboard: `src/pages/dashboard.astro`
- Card delete API: `src/pages/api/flashcards/delete.ts`
- Set detail loader: `src/lib/load-set-detail.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Set update/delete API routes

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Build passes: `npm run build`

#### Manual

- [x] 1.3 Manual API checks for update/delete (auth, validation, RLS, cascade)

### Phase 2: Dashboard list island + AlertDialog

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Build passes: `npm run build`

#### Manual

- [ ] 2.3 Inline rename and empty/non-empty delete flows in UI

### Phase 3: Wire dashboard SSR + regression checks

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Dashboard E2E + deleted-set URL + preserved flows (create, cards, SRS, AI)
