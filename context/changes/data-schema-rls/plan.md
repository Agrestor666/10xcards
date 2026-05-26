# Data Schema + RLS (F-01) Implementation Plan

## Overview

Add the first application database layer for 10xCards: `flashcard_sets` and `flashcards` tables in Supabase with row-level security so each authenticated user can only access their own data. This foundation slice unblocks S-01 through S-04; it delivers schema, RLS, and shared TypeScript types only — no API routes or UI.

## Current State Analysis

- **Auth:** Supabase SSR client (`src/lib/supabase.ts`) and middleware resolve `context.locals.user` via `auth.getUser()`; `User.id` maps to `auth.users.id` but is unused for data access today.
- **Data:** No `supabase/migrations/`; README still states auth-only (line 114). `supabase/config.toml` targets Postgres 17.
- **Types:** No `src/types.ts`; no generated Database types.
- **Product:** PRD requires private sets (owner-only), durable cards, per-card SRS scheduling (FR-011); roadmap names `flashcard_sets`, `flashcards`, and SRS fields — algorithm choice deferred to S-04.

### Key Discoveries:

- `src/middleware.ts` — only `/dashboard` is protected; F-01 does not expand routes.
- `SUPABASE_KEY` is the anon key with session cookies — RLS must enforce all data access.
- Roadmap risk: SRS column mismatch forces a follow-up migration before S-04.

## Desired End State

After this plan:

1. A single migration creates `flashcard_sets` and `flashcards` with FKs, indexes, and defaults.
2. RLS is enabled on both tables; `authenticated` role can CRUD only rows owned via `auth.uid()` (sets directly; cards via owned set).
3. `src/types.ts` exports entity types matching the schema.
4. Local `npx supabase db reset` applies the migration cleanly; README documents how to push to a hosted project.

**Verification:** Log in as two test users in Studio or `psql`; user A cannot SELECT/INSERT/UPDATE/DELETE user B's sets or cards.

## What We're NOT Doing

- Application API routes or Astro pages that query flashcard tables (S-01+).
- Choosing or integrating an SRS library (S-04); only storage shape (`srs_state` JSONB + `due_at`).
- Generated Supabase `Database` types (`supabase gen types`).
- Set `description`, `slug`, soft-delete, or set rename/delete UX.
- Storing pasted source text (PRD NFR — no table for it).
- CI apply to remote Supabase (secrets not wired for DB push).
- `updated_at` auto-triggers (optional; slices can set timestamps in app code).

## Implementation Approach

One migration file plus RLS policies in the same migration (atomic apply). Ownership is modeled only on `flashcard_sets.user_id`; `flashcards` inherit access through `set_id` + `EXISTS` subquery policies. SRS state uses **JSONB `srs_state`** (opaque to F-01) and **`due_at`** (indexed for future session queries). New cards default to `due_at = now()` and `srs_state = '{}'` so they appear in the first review session (US-02).

## Critical Implementation Details

**`srs_state` / `due_at` contract:** S-04 owns keeping them in sync when a grading library is wired. F-01 only defines storage: on insert, default `due_at = now()` and `srs_state = '{}'`. Any session query in S-04 should filter on `due_at <= now()` (and owned set). Do not embed algorithm-specific keys in F-01 beyond documenting the empty-object default.

## Phase 1: Schema migration

### Overview

Create `flashcard_sets` and `flashcards` with constraints, indexes, and defaults in the first Supabase migration.

### Changes Required:

#### 1. Initial migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_flashcard_schema.sql`

**Intent**: Introduce both tables, foreign keys, and indexes so later slices can read/write sets and cards without schema changes for basic CRUD + SRS storage.

**Contract**:

- **`flashcard_sets`**
  - `id` `uuid` PK, default `gen_random_uuid()`
  - `user_id` `uuid` NOT NULL → `auth.users(id)` ON DELETE CASCADE
  - `name` `text` NOT NULL
  - `created_at`, `updated_at` `timestamptz` NOT NULL DEFAULT `now()`
- **`flashcards`**
  - `id` `uuid` PK, default `gen_random_uuid()`
  - `set_id` `uuid` NOT NULL → `flashcard_sets(id)` ON DELETE CASCADE
  - `question`, `answer` `text` NOT NULL
  - `srs_state` `jsonb` NOT NULL DEFAULT `'{}'::jsonb`
  - `due_at` `timestamptz` NOT NULL DEFAULT `now()`
  - `created_at`, `updated_at` `timestamptz` NOT NULL DEFAULT `now()`
- **Indexes:** `flashcard_sets(user_id)`; `flashcards(set_id)`; `flashcards(set_id, due_at)` for due-card queries in S-04
- **Comments:** Brief SQL comments on `srs_state` and `due_at` columns noting S-04 ownership of algorithm sync

### Success Criteria:

#### Automated Verification:

- Migration file follows naming convention `YYYYMMDDHHmmss_short_description.sql` under `supabase/migrations/`
- Local stack applies migration: `npx supabase db reset` (requires Docker; exits 0)
- Tables exist: `flashcard_sets`, `flashcards` visible in `npx supabase status` Studio or `\dt` in local DB

#### Manual Verification:

- `\d flashcard_sets` and `\d flashcards` show expected columns, FKs, and indexes
- Deleting a `flashcard_sets` row cascades to its `flashcards` rows

**Implementation Note**: Pause for human confirmation after automated checks before Phase 2.

---

## Phase 2: RLS policies

### Overview

Enable RLS and add granular per-operation policies for the `authenticated` role on both tables.

### Changes Required:

#### 1. RLS in migration (same file or follow-up — prefer same file)

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_flashcard_schema.sql` (append to Phase 1 migration before first apply)

**Intent**: Enforce PRD access control: sets and cards are private to the account owner. No `service_role` bypass in application code for user data.

**Contract**:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both tables
- **`flashcard_sets`** — for role `authenticated`:
  - SELECT / UPDATE / DELETE: `user_id = auth.uid()`
  - INSERT: `user_id = auth.uid()` (WITH CHECK on INSERT)
- **`flashcards`** — for role `authenticated`:
  - All operations: `EXISTS (SELECT 1 FROM flashcard_sets s WHERE s.id = flashcards.set_id AND s.user_id = auth.uid())`
  - INSERT WITH CHECK: same EXISTS (and `set_id` references an owned set)
- No policies for `anon` on these tables
- Do not grant broad `ALL` to `public`

### Success Criteria:

#### Automated Verification:

- Migration still applies cleanly: `npx supabase db reset`
- Supabase advisors (optional): `npx supabase db lint` if available locally — no critical RLS-disabled findings on new tables

#### Manual Verification:

- As user A (authenticated via Studio SQL editor `set request.jwt.claim.sub` or app signup): can INSERT/SELECT own set and card
- As same session, cannot SELECT another user's set_id (use second test user)
- Unauthenticated role cannot SELECT from either table

**Implementation Note**: Pause for human confirmation after manual RLS checks before Phase 3.

---

## Phase 3: Types, docs & verification

### Overview

Expose schema-shaped TypeScript types for downstream slices and update project docs for the new database workflow.

### Changes Required:

#### 1. Shared entity types

**File**: `src/types.ts`

**Intent**: Give S-01+ a single import for flashcard domain shapes aligned with the DB columns.

**Contract**:

- Export `FlashcardSet` (id, user_id, name, created_at, updated_at as strings or Date — match existing project date conventions; prefer ISO strings if Supabase client returns strings)
- Export `Flashcard` (id, set_id, question, answer, srs_state as `Record<string, unknown>` or `Json`, due_at, created_at, updated_at)
- Export optional `FlashcardSetInsert`, `FlashcardInsert` omitting generated fields if useful for API work in S-01

#### 2. README database section

**File**: `README.md`

**Intent**: Replace the auth-only database note (line ~114) with instructions for migrations, local reset, and pushing to cloud.

**Contract**:

- Document `npx supabase start` / `db reset` / `migration list`
- Document remote: link project, `npx supabase db push` (manual step post-F-01)
- List tables at high level (`flashcard_sets`, `flashcards`)

#### 3. Change metadata

**File**: `context/changes/data-schema-rls/change.md`

**Intent**: Mark change as planned after plan review.

**Contract**: `status: planned`, `updated: 2026-05-26`

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes (no new env vars required)
- `src/types.ts` exists and exports `FlashcardSet` and `Flashcard`

#### Manual Verification:

- README accurately describes migration workflow
- Quick type sanity: import types in a scratch check or existing file without TS errors (optional inline test in implement phase)

**Implementation Note**: Final human sign-off that F-01 is ready for S-01 (`flashcard-sets-ui`).

---

## Testing Strategy

### Unit Tests:

- None required for F-01 (schema-only). S-01 may add service tests against local Supabase.

### Integration Tests:

- Deferred to slices that call Supabase from API routes.

### Manual Testing Steps:

1. `npx supabase start` then `npx supabase db reset`
2. Create two users via app signup or Studio Auth
3. Insert set + card as user A; confirm user B cannot read via SQL with B's JWT context
4. Delete user A's set; confirm cards removed (CASCADE)
5. Run `npm run lint` and `npm run build`

## Performance Considerations

- Composite index `(set_id, due_at)` supports due-card queries per set at MVP scale (small data volume per PRD).
- JSONB `srs_state` is fine for single-row card updates; no GIN index unless S-04 needs JSON path queries.

## Migration Notes

- **Local:** `npx supabase db reset` replays all migrations (destructive to local data).
- **Remote:** After merge, operator runs `npx supabase link` + `npx supabase db push` against hosted project; document in README — not automated in CI for F-01.
- **Rollback:** Revert migration file and reset, or add a down migration if already pushed to shared remote (coordinate with team before push).

## References

- Roadmap F-01: `context/foundation/roadmap.md` (lines 64–75, 146)
- PRD: `context/foundation/prd.md` (Access Control, FR-003/007/008–011, NFR durability)
- Supabase client: `src/lib/supabase.ts`
- Middleware auth: `src/middleware.ts`
- Repo conventions: `AGENTS.md`, `CLAUDE.md` (migrations path, RLS requirement)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema migration

#### Automated

- [x] 1.1 Migration file follows naming convention under `supabase/migrations/`
- [x] 1.2 Local stack applies migration: `npx supabase db reset` exits 0
- [x] 1.3 Tables `flashcard_sets` and `flashcards` exist after reset

#### Manual

- [x] 1.4 Column, FK, and index definitions match plan (`\d` / Studio)
- [x] 1.5 Deleting a set cascades to its cards

### Phase 2: RLS policies

#### Automated

- [ ] 2.1 Migration applies cleanly after RLS additions: `npx supabase db reset` exits 0
- [ ] 2.2 Optional: `npx supabase db lint` reports no critical RLS issues on new tables

#### Manual

- [ ] 2.3 User A can CRUD own sets and cards; cannot access user B's rows
- [ ] 2.4 Unauthenticated role cannot read flashcard tables

### Phase 3: Types, docs & verification

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` passes
- [ ] 3.3 `src/types.ts` exports `FlashcardSet` and `Flashcard`

#### Manual

- [ ] 3.4 README documents local migration and remote push workflow
- [ ] 3.5 Human sign-off: F-01 ready for `/10x-implement flashcard-sets-ui` (S-01)
