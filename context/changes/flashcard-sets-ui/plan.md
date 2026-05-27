# Flashcard sets UI (S-01) Implementation Plan

## Overview

Implement the first post-login product screen: a protected `/dashboard` page where a signed-in user can create a named flashcard set and browse all of their existing sets.

## Current State Analysis

- Auth is implemented with Supabase SSR cookies (`src/lib/supabase.ts`) and a request middleware that protects `/dashboard` (`src/middleware.ts`).
- Existing “dashboard” page is a placeholder that only shows the user email and a sign-out button (`src/pages/dashboard.astro`).
- Domain schema/types are defined by F-01 (tables `flashcard_sets`/`flashcards`, RLS, `src/types.ts`). S-01 consumes the `flashcard_sets` contract.

## Desired End State

- Visiting `/dashboard` while signed in shows:
  - An inline “New set” form (name input + Create button).
  - A list of the user’s flashcard sets ordered by most recently updated.
  - A focused empty state when the user has no sets yet.
- Creating a set via the form persists it in Supabase and redirects back to `/dashboard` where the new set appears at the top.
- Errors (validation or Supabase) redirect back to `/dashboard?error=...` and render a visible error banner.

### Key Discoveries:

- Protected routes are currently a static prefix list in middleware (`src/middleware.ts`), and `/dashboard` is already protected.
- Supabase SSR client is created per-request from headers + cookies (`src/lib/supabase.ts`), matching the API route auth patterns (`src/pages/api/auth/*.ts`).
- `FlashcardSet` shape exists already (`src/types.ts`) and F-01 defines `flashcard_sets.updated_at` for ordering.

## What We're NOT Doing

- Set detail page (`/sets/<id>`) or any per-set navigation.
- Flashcard CRUD inside a set (S-03).
- AI generation (S-02) or SRS review flow (S-04).
- Client-side toasts; MVP uses query-param errors and server redirects.

## Implementation Approach

- Keep S-01 server-rendered (Astro page + HTML forms). No React island is required for the create flow.
- Add one new API route to create sets via `POST` with `formData`, following existing auth route conventions (redirect on success/failure).
- In `/dashboard`, query Supabase for the signed-in user’s sets and render the list/empty state.

## Phase 1: Data plumbing + create endpoint

### Overview

Add the minimal server endpoints and input validation needed to create a set safely and deterministically (trimmed name, length limits, redirect-on-error).

### Changes Required:

#### 1. Create “flashcard set create” API route

**File**: `src/pages/api/flashcard-sets/create.ts`

**Intent**: Accept an HTML form POST, validate the set name, ensure the request is authenticated, and insert a new row into `flashcard_sets` owned by the current user.

**Contract**:

- HTTP: `POST /api/flashcard-sets/create`
- Input: `FormData` field `name`
- Validation: trim whitespace; require length 1–80; allow duplicates
- Auth: use `createClient(context.request.headers, context.cookies)`; require `supabase.auth.getUser()` to return a user
- Insert: `flashcard_sets` row with `{ user_id: user.id, name }`
- Redirects:
  - success → `/dashboard`
  - failure → `/dashboard?error=<message>`

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- When signed in, submitting the create form successfully redirects to `/dashboard` without errors.
- Invalid names (empty / whitespace-only / >80 chars) redirect back to `/dashboard` and show an error banner.

---

## Phase 2: `/dashboard` sets index UI (list + empty state + form)

### Overview

Replace the placeholder dashboard with the S-01 product screen: inline create form + list of sets, ordered by `updated_at DESC`.

### Changes Required:

#### 1. Render sets list and create form on the dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Server-render the sets index: show the signed-in user’s sets, inline create form, empty state, and a sign-out control. Surface any `?error=` as an on-page banner.

**Contract**:

- Reads query param `error` and renders it prominently.
- Uses `createClient(Astro.request.headers, Astro.cookies)` (or `Astro` equivalents available in frontmatter) to query:
  - `flashcard_sets`: select `id, name, created_at, updated_at`
  - order by `updated_at` descending
- UI:
  - Inline form: `method="POST" action="/api/flashcard-sets/create"`
  - Empty state: short message + visible form (primary CTA)
  - List: set name + secondary metadata (optional: created/updated relative time; keep minimal)

#### 2. Ensure navigation keeps working

**File**: `src/components/Topbar.astro`

**Intent**: Keep the topbar link pointing to `/dashboard` as the “Sets” home.

**Contract**:

- Replace “Dashboard” label with “Sets” (optional polish) while keeping href `/dashboard`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Signed-in user sees their email + sign-out and the sets screen at `/dashboard`.
- If the user has 0 sets, the empty state renders and the create form is usable.
- If the user has sets, the list renders and is ordered by newest `updated_at` first.
- Creating a set shows it at the top after redirect.

---

## Phase 3: Hardening + RLS sanity checks

### Overview

Add lightweight safeguards and verify the behavior aligns with the F-01 RLS expectations.

### Changes Required:

#### 1. Improve error messages and edge handling

**File**: `src/pages/api/flashcard-sets/create.ts`

**Intent**: Ensure error strings are user-friendly and do not leak internal details; guard against missing Supabase config.

**Contract**:

- If Supabase is not configured: redirect with a clear message.
- For Supabase insert errors: show a concise message (e.g., “Could not create set” + specific message only if safe).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Two different signed-in users cannot see each other’s sets in `/dashboard`.
- A user cannot create a set for a different `user_id` (server always uses authenticated `user.id`).

---

## Testing Strategy

### Unit Tests:

- (Optional for MVP) Pure validation helper for set name (trim + length) if factored into a small function.

### Integration Tests:

- Not required for MVP given current repo setup (no test harness present); rely on manual checks + lint/build gates.

### Manual Testing Steps:

1. Sign in with User A → open `/dashboard` → create “Biology” → confirm it appears.
2. Create an invalid name (empty or 81+ chars) → confirm error banner appears.
3. Sign out; sign in with User B → open `/dashboard` → confirm User A sets are not visible.

## Performance Considerations

- The list query is a simple filtered + ordered select on `flashcard_sets`. Ordering by `updated_at` relies on F-01’s column + default; expected scale is small in MVP.

## Migration Notes

- Requires F-01 migration applied to the target environment so `flashcard_sets` exists with RLS enabled.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- Supabase SSR client: `src/lib/supabase.ts`
- Protected routes middleware: `src/middleware.ts`
- Domain types: `src/types.ts`
- F-01 schema plan: `context/changes/data-schema-rls/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data plumbing + create endpoint

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Build passes: `npm run build`

#### Manual

- [x] 1.3 Create set redirects to `/dashboard` and persists
- [x] 1.4 Invalid name shows `/dashboard?error=...` banner

### Phase 2: `/dashboard` sets index UI (list + empty state + form)

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [x] 2.3 Empty state renders when user has no sets
- [x] 2.4 Sets list renders and is ordered by newest `updated_at`
- [x] 2.5 New set appears at top after redirect

### Phase 3: Hardening + RLS sanity checks

#### Automated

- [x] 3.1 Lint passes: `npm run lint`
- [x] 3.2 Build passes: `npm run build`

#### Manual

- [x] 3.3 User isolation verified (User A cannot see User B sets and vice versa)
- [x] 3.4 API always uses authenticated `user.id` for `user_id`
