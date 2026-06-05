# AI generation + save (S-02) Implementation Plan

## Overview

Implement the north-star flow: a logged-in user pastes raw text, gets AI-generated Q+A flashcards, edits/deletes cards inline, then saves accepted cards into one of their existing sets.

## Current State Analysis

- Auth (Supabase SSR) is implemented and enforced for `/dashboard` via `src/middleware.ts`.
- Flashcard sets exist end-to-end:
  - `src/pages/dashboard.astro` lists sets from `flashcard_sets` and provides a create-set form.
  - `src/pages/api/flashcard-sets/create.ts` inserts sets using authenticated session ownership and redirects back to `/dashboard`.
- DB schema + RLS are present via migration `supabase/migrations/20260526211944_flashcard_schema.sql` (tables `flashcard_sets`, `flashcards`).
- There is currently **no AI/OpenRouter integration** and no flashcards insert endpoint(s).

## Desired End State

On `/dashboard`, a user can:

- Paste text (within enforced size limits) and click **Generate**.
- See a list of generated cards (question + answer) in the UI.
- Edit question/answer inline for any card.
- Delete any card from the preview.
- Pick an existing set and click **Save**.
- See a clear success state; saved cards are persisted under RLS and visible for later work (S-03/S-04).

### Key Discoveries

- Existing set creation flow uses **server redirects** and **never trusts client ownership**:
  - `src/pages/api/flashcard-sets/create.ts` sets `user_id` from session only.
- The DB schema already supports immediate review by default:
  - `public.flashcards.due_at` defaults to `now()` (migration comment).
- Server-only secrets are wired through `astro:env/server` with schema in `astro.config.mjs`:
  - `SUPABASE_URL`, `SUPABASE_KEY` are `context: "server", access: "secret"`.

## What We're NOT Doing

- Anonymous generation (generation remains behind auth, consistent with current protected routes).
- Streaming generation or background jobs / polling.
- Deduplication against existing cards or semantic similarity checks.
- Review session launch (S-04 owns that).
- File import (PDF/DOCX/etc.) — paste-only (PRD non-goal).

## Implementation Approach

- Keep the generator **on `/dashboard`** as a new section rendered by a **React island** (to support inline edit/delete state).
- Add a server API route for AI generation that:
  - validates input,
  - calls OpenRouter via `fetch`,
  - parses and validates a strict JSON response shape,
  - returns structured errors safe for the UI.
- Add a server API route for saving accepted cards that:
  - validates payload,
  - ensures user is authenticated via cookie session,
  - bulk-inserts into `public.flashcards` for the chosen `set_id`,
  - relies on RLS to enforce set ownership (and maps permission errors to user-safe messages).

## Critical Implementation Details

- The AI response MUST be treated as untrusted input. Even with a “JSON-only” prompt, the server route must enforce a strict zod schema and handle invalid JSON gracefully (return a safe error to UI, do not log raw pasted text).
- Do not persist the pasted source text anywhere (DB, KV, logs). Keep it only in memory during the request lifecycle.

## Phase 1: Server-side foundations (env + API contracts)

### Overview

Create server-only configuration and API endpoints for (a) generation and (b) bulk save.

### Changes Required

#### 1. OpenRouter server env wiring

**File**: `astro.config.mjs`

**Intent**: Add server-only env fields needed for OpenRouter calls.

**Contract**:
- Add `OPENROUTER_API_KEY` as `context: "server"`, `access: "secret"`.
- Optional follow-ups (only if used): `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` (default to `https://openrouter.ai/api/v1` in code if omitted).

#### 2. Generator API route (OpenRouter call)

**File**: `src/pages/api/ai/generate.ts` (new)

**Intent**: Accept pasted text, call OpenRouter, return validated card drafts.

**Contract**:
- `export const prerender = false`
- `POST` accepts JSON: `{ text: string }`
- Validates:
  - `text.trim()` non-empty
  - hard limit by characters (client + server)
- Returns JSON:
  - success: `{ ok: true, cards: Array<{ question: string; answer: string }> }`
  - error: `{ ok: false, message: string }` with user-safe message
- Must enforce a **server timeout** for the upstream call (Workers fetch + AbortController).
- Must not include raw source text in logs or error messages.

#### 3. Bulk-save API route (insert flashcards)

**File**: `src/pages/api/flashcards/bulk-create.ts` (new)

**Intent**: Insert accepted card drafts into `public.flashcards` under a chosen set.

**Contract**:
- `export const prerender = false`
- `POST` accepts JSON: `{ setId: string, cards: Array<{ question: string; answer: string }> }`
- Validates:
  - `setId` is a UUID (zod `uuid()`)
  - `cards.length >= 1`
  - each `question` and `answer` is non-empty after trim; reasonable max length bounds
- Authentication:
  - uses `createClient(context.request.headers, context.cookies)`
  - uses `supabase.auth.getUser()`; redirect or return `{ ok:false }` with “please sign in”
- Insert:
  - `supabase.from("flashcards").insert([...])` with `set_id`, `question`, `answer`
  - do not accept `user_id` from client; ownership is derived via RLS on `set_id`
- Errors:
  - map permission-denied / RLS errors to user-safe strings (no raw DB messages)

### Success Criteria

#### Automated Verification

- `npm run lint`
- `npm run build` (with required env present)

#### Manual Verification

- Calling `/api/ai/generate` with valid input returns `{ ok: true, cards: [...] }` and never exposes the pasted text in response.
- Calling `/api/flashcards/bulk-create` with a set owned by the user inserts rows; with a set not owned, returns a permission-safe error.

---

## Phase 2: Dashboard generator UI (React island)

### Overview

Add a generator section to `/dashboard` with paste → generate → preview/edit/delete behavior, and a set selector for saving.

### Changes Required

#### 1. Generator React component

**File**: `src/components/generator/FlashcardGenerator.tsx` (new)

**Intent**: Provide interactive UI state for generating and reviewing cards.

**Contract**:
- Props include:
  - `sets: Array<{ id: string; name: string }>` (from server-rendered dashboard query)
  - `initialSelectedSetId?: string`
- Local state includes:
  - `text`, `isGenerating`, `cardsDraft: Array<{ id: string; question: string; answer: string }>`
  - `selectedSetId`, `saveStatus` (idle/saving/success/error)
- UX:
  - Disable Generate while generating; show spinner/progress state.
  - Render card list with inline editable fields (question/answer).
  - Allow deleting cards from the draft.
  - Save button disabled if no cards remain or no set selected.
- Network:
  - `POST /api/ai/generate` for generation
  - `POST /api/flashcards/bulk-create` for save
- Error display:
  - Show a single user-safe error banner/message for generate failures and save failures.

#### 2. Render generator section on dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Render the generator section above (or between) the existing set creation and set list.

**Contract**:
- Import the React island and pass `sets` from the existing server query.
- Ensure the dashboard remains SSR-friendly; the generator should hydrate via `client:load` or `client:visible` depending on preferred UX.

### Success Criteria

#### Automated Verification

- `npm run lint`
- `npm run build`

#### Manual Verification

- On `/dashboard`, user can paste text and see loading state immediately when generating.
- Generated cards render with separate question/answer fields.
- User can edit question/answer, delete cards, and the UI updates correctly.

---

## Phase 3: Save flow confirmation + error mapping

### Overview

Ensure saving is robust, user-safe, and provides a clear confirmation path.

### Changes Required

#### 1. User-safe error mapping for flashcard bulk insert

**File**: `src/lib/flashcard-errors.ts` (new)

**Intent**: Centralize mapping of Supabase/Postgres errors to user-safe strings, similar to set creation.

**Contract**:
- Export a function like `flashcardBulkCreateErrorMessage(error: { code?: string }): string`
- Handle permission denied (`42501`) explicitly.
- Provide a generic fallback message.

#### 2. Post-save landing behavior

**File**: `src/pages/dashboard.astro` and/or generator component

**Intent**: After save, show success and move user toward the destination set context.

**Contract**:
- MVP fallback if no set detail page exists yet:
  - show success banner “Saved N cards to <set name>”.
  - optionally reset text + drafts.
- If/when a set detail route exists:
  - redirect or link to that set.

### Success Criteria

#### Automated Verification

- `npm run lint`
- `npm run build`

#### Manual Verification

- Save is blocked when no cards remain, with a clear UI message.
- When save succeeds, user sees a success confirmation that indicates the destination set.
- Permission errors are user-safe and do not leak SQL/policy names.

---

## Testing Strategy

### Unit Tests

- Input validation helpers (text limits, trim rules) if extracted into `src/lib/`.
- Error-mapping utilities (`flashcard-errors.ts`).

### Integration Tests

- (If/when test runner exists) request/response contract tests for:
  - `/api/ai/generate` returns `{ ok:false }` on invalid input and on missing OpenRouter key.
  - `/api/flashcards/bulk-create` rejects unauthenticated requests.

### Manual Testing Steps

1. Ensure you are signed in and have at least one set on `/dashboard`.
2. Paste a short text (within limit) → click Generate → confirm cards appear.
3. Edit one question and one answer → delete one card → click Save to a chosen set.
4. Verify no raw pasted text appears in UI errors, network responses, or logs.
5. Simulate failure:
   - temporarily remove OpenRouter key → confirm generate shows a user-safe error.
   - attempt save with invalid set id → confirm server rejects with user-safe error.

## Performance Considerations

- Enforce strict input limits and request timeout to meet the <10s perceived generation NFR on typical inputs.
- Prefer a small/fast model by default; leave room to tune later.

## Migration Notes

- No schema migrations required for S-02 (schema already includes `flashcards` and RLS policies).

## References

- PRD: `context/foundation/prd.md` (FR-004, FR-005, US-01, NFR: <10s, no source text persistence)
- Roadmap: `context/foundation/roadmap.md` (S-02 north star)
- Schema + RLS: `supabase/migrations/20260526211944_flashcard_schema.sql`
- Existing sets flow:
  - `src/pages/dashboard.astro`
  - `src/pages/api/flashcard-sets/create.ts`
  - `src/lib/flashcard-set-errors.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server-side foundations (env + API contracts)

#### Automated

- [x] 1.1 Lint passes (`npm run lint`)
- [x] 1.2 Build passes (`npm run build`)

#### Manual

- [x] 1.3 Generate endpoint returns validated cards (no text leakage)
- [x] 1.4 Bulk-create inserts to owned set; permission errors are user-safe

### Phase 2: Dashboard generator UI (React island)

#### Automated

- [x] 2.1 Lint passes (`npm run lint`)
- [x] 2.2 Build passes (`npm run build`)

#### Manual

- [x] 2.3 Paste→Generate shows progress + renders cards
- [x] 2.4 Inline edit/delete works correctly

### Phase 3: Save flow confirmation + error mapping

#### Automated

- [x] 3.1 Lint passes (`npm run lint`)
- [x] 3.2 Build passes (`npm run build`)

#### Manual

- [x] 3.3 Save blocks on zero cards; success confirmation shows destination set
