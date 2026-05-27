# Flashcard sets UI (S-01) — Plan Brief

> Full plan: `context/changes/flashcard-sets-ui/plan.md`

## What & Why

S-01 turns the current placeholder dashboard into the first real product screen: a signed-in user can create named flashcard sets and browse all of their sets. This is the navigation/data foundation every later slice builds on (AI generation saves into a set; manual CRUD and SRS operate within a set).

## Starting Point

Auth is already wired (Supabase SSR cookies + middleware protecting `/dashboard`). F-01 provides the `flashcard_sets` table contract and `FlashcardSet` type, but there is no UI or API yet to create or list sets.

## Desired End State

At `/dashboard` (protected), the user sees an inline “New set” form and a list of their sets sorted by `updated_at` (newest first). Submitting the form creates a `flashcard_sets` row for the current user and redirects back to `/dashboard`, where the new set appears at the top; errors are shown via a visible banner using `?error=...`.

## Key Decisions Made

| Decision    | Choice                              | Why (1 sentence)                                                         |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Route       | `/dashboard` becomes the sets index | Reuses existing protected route + navigation with minimal routing churn. |
| Create UX   | Inline form on the page             | Fastest “create multiple sets” flow with low UI complexity.              |
| Name rules  | 1–80 chars, trim, allow duplicates  | Keeps MVP friction low and avoids uniqueness edge cases.                 |
| Error UX    | Redirect + `?error=` banner         | Matches the repo’s existing auth patterns.                               |
| Detail page | Not in S-01                         | Keep slice aligned to roadmap outcome (create + list only).              |
| Ordering    | `updated_at DESC`                   | “Recent work on top” expectation; supported by F-01 schema.              |

## Scope

**In scope:**

- A protected `/dashboard` sets index (SSR) showing list + empty state + create form
- `POST` API route to create sets in Supabase (owned by the current user)
- Query-param error banner pattern for create/list failures

**Out of scope:**

- Set detail page, flashcard CRUD, AI generation, SRS review session
- Toast system or rich client-side state management

## Architecture / Approach

Server-rendered Astro page + standard HTML forms:

- `/dashboard` queries Supabase for the user’s `flashcard_sets` and renders UI.
- The create form posts to `/api/flashcard-sets/create`, which validates input, inserts `{ user_id: user.id, name }`, then redirects back to `/dashboard`.

## Phases at a Glance

| Phase              | What it delivers                                              | Key risk                              |
| ------------------ | ------------------------------------------------------------- | ------------------------------------- |
| 1. Create endpoint | `POST /api/flashcard-sets/create` with validation + redirects | Auth/RLS mismatch blocks inserts      |
| 2. Dashboard UI    | List sets, empty state, inline create form, error banner      | SSR query or UI state feels confusing |
| 3. Hardening       | Friendlier errors + quick RLS sanity checks                   | Subtle policy issue leaks/blocks data |

**Prerequisites:** F-01 migration applied to the environment (tables exist + RLS enabled).
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes F-01 schema is deployed to whichever Supabase project the app uses locally/remote.
- `updated_at` isn’t auto-maintained by triggers; S-01 only depends on it for ordering at creation-time (future edits should update it).

## Success Criteria (Summary)

- Signed-in user can create a set and see it in their `/dashboard` list
- Errors show as a visible banner via `?error=...`
- User data isolation holds (one user cannot see another user’s sets)
