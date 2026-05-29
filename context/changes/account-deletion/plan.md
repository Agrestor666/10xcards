# Account deletion (S-06) Implementation Plan

## Overview

Let signed-in users permanently delete their account from a new `/settings` page. Deletion requires explicit confirmation (modal + typing `DELETE`), removes the Supabase Auth user via the Admin API (service role, server-only), and relies on existing FK cascades to purge `flashcard_sets` and `flashcards`. Session is cleared and the user is sent to the public landing page.

## Current State Analysis

- **Auth:** Sign-in, sign-up, sign-out work via SSR cookie client (`src/lib/supabase.ts`, `src/pages/api/auth/*`, `src/middleware.ts`).
- **No account settings UI:** Email appears in `Topbar.astro` and `dashboard.astro`; no `/settings` route.
- **Data model ready:** `flashcard_sets.user_id` → `auth.users(id) ON DELETE CASCADE`; `flashcards.set_id` → `flashcard_sets(id) ON DELETE CASCADE` (`supabase/migrations/20260526211944_flashcard_schema.sql`).
- **Destructive UX pattern exists:** `SetDashboardList.tsx` uses shadcn `AlertDialog` + JSON `fetch` for set delete (`src/pages/api/flashcard-sets/delete.ts`).
- **Gaps:** No `SUPABASE_SERVICE_ROLE_KEY` in `astro.config.mjs` / `.env.example`; no admin Supabase client; no `auth.admin.deleteUser` usage anywhere in `src/`.
- **No test runner** in repo; verification is lint, build, and manual UI.

## Desired End State

A signed-in user can:

1. Open **Settings** from the top bar (`/settings`).
2. See a danger zone explaining that account deletion is permanent and lists how many sets and flashcards will be removed.
3. Open a confirmation dialog, type `DELETE`, and confirm.
4. Have their Auth user deleted, all app data cascaded away, session ended, and land on `/` (or sign-in) with no access to former protected routes.

Verification: deleted user cannot sign in with old credentials; no orphaned `flashcard_sets` / `flashcards` rows for that `user_id`; other users’ data unchanged; `npm run lint` and `npm run build` pass.

### Key Discoveries:

- Deleting `auth.users` first is correct for this schema — Postgres cascades app tables; manual set deletion before account delete is unnecessary (`roadmap.md` risk note).
- Anon/session client cannot delete Auth users; service role is required only on the dedicated delete route (`stack-assessment.md` pattern: never use service role for normal CRUD).
- `alert-dialog` is already installed for set-dashboard lifecycle — reuse, do not re-add.

## What We're NOT Doing

- Password re-entry or email-link confirmation flow (MVP: modal + typed `DELETE`; roadmap allows upgrading later).
- Soft delete / account recovery / grace period.
- Export-my-data before delete.
- Admin panel to delete other users.
- GDPR data-export automation (hard delete satisfies erasure for current schema).
- Vitest or new CI test stages.
- Deleting Storage objects (no Storage usage in MVP schema).

## Implementation Approach

1. Add server-only `SUPABASE_SERVICE_ROLE_KEY` and a tiny `createAdminClient()` used exclusively by the delete-account API.
2. Implement `POST /api/auth/delete-account` with session verification, zod body `{ confirm: "DELETE" }`, `auth.admin.deleteUser(user.id)`, then `signOut()` on the cookie client.
3. Add protected `/settings` page with SSR counts for confirmation copy and a React island (`AccountDangerZone`) mirroring set-delete fetch + `AlertDialog` patterns.
4. Wire **Settings** link in `Topbar.astro` and extend `PROTECTED_ROUTES`.

## Critical Implementation Details

**Deletion order:** Call `auth.admin.deleteUser(id)` once. Do not manually delete sets/cards first — FK cascade handles app data when the auth row disappears. If future tables reference `auth.users` without `ON DELETE CASCADE`, extend migration before relying on this flow.

**Service role isolation:** `createAdminClient()` must not be imported from pages/components that handle normal user traffic. Only `src/pages/api/auth/delete-account.ts` (and optionally a one-line re-export guard comment in `supabase-admin.ts`).

**Session after delete:** After successful `deleteUser`, call `signOut()` on the SSR client so cookies clear even if the JWT is already invalid. Client redirects to `/` on `{ ok: true }`.

**Typed confirmation:** Confirm button stays disabled until input value equals exactly `DELETE` (case-sensitive). This is stricter than set empty-delete and appropriate for irreversible account loss.

## Phase 1: Service role env + delete-account API

### Overview

Introduce the admin client and a single authenticated API route that deletes the current user and ends the session.

### Changes Required:

#### 1. Env schema and examples

**File**: `astro.config.mjs`

**Intent**: Declare service role key as a server secret so Cloudflare/Node can load it without exposing it to the client bundle.

**Contract**:
- Add `SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true })` alongside existing Supabase fields.

**File**: `.env.example`

**Intent**: Document the new secret for local dev and Wrangler setup.

**Contract**:
- Add `SUPABASE_SERVICE_ROLE_KEY=###` with a comment: server-only; never commit real values; required for account deletion in production.

**File**: `CLAUDE.md` / `AGENTS.md` (optional one-line)

**Intent**: Note that service role is used only for account deletion.

**Contract**: Mention `SUPABASE_SERVICE_ROLE_KEY` in the Environment section if those files list env vars.

#### 2. Admin Supabase client

**File**: `src/lib/supabase-admin.ts`

**Intent**: Factory for a non-persisted Supabase client using the service role key.

**Contract**:
- Export `createAdminClient(): SupabaseClient | null`
- Returns `null` when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing (mirror `createClient` null pattern in `src/lib/supabase.ts`)
- `createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })`

#### 3. Account deletion error messages

**File**: `src/lib/account-errors.ts`

**Intent**: User-safe messages for delete-account failures.

**Contract**:
- Export `SUPABASE_ADMIN_NOT_CONFIGURED_MESSAGE` (service role missing)
- Export `accountDeleteErrorMessage(error: unknown): string` — generic fallback; log details server-side only

#### 4. Delete account API

**File**: `src/pages/api/auth/delete-account.ts`

**Intent**: Authenticated endpoint that deletes the current Auth user and signs out.

**Contract**:
- `export const prerender = false`
- Zod body: `{ confirm: z.literal("DELETE") }`
- Flow:
  1. `createClient(headers, cookies)` → `getUser()` → 401 if missing
  2. Parse JSON / `safeParse` → 400 on failure
  3. `createAdminClient()` → 503 `{ ok: false, message: SUPABASE_ADMIN_NOT_CONFIGURED_MESSAGE }` if null
  4. `admin.auth.admin.deleteUser(user.id)` — on error → 403 with `accountDeleteErrorMessage`
  5. `await supabase.auth.signOut()` on session client (best-effort if delete succeeded)
  6. Success: `jsonResponse({ ok: true })`
- Never accept a `userId` in the body — always delete `getUser()` identity only.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build` (service role optional in CI — route compiles; runtime 503 without key is acceptable for CI)

#### Manual Verification:

- With service role configured: authenticated `POST` with `{ "confirm": "DELETE" }` returns `{ ok: true }`
- Same user cannot `getUser()` / sign in afterward; sets and cards for that user are gone in Supabase
- Missing/wrong `confirm` → 400; no session → 401; missing service role → 503

**Implementation Note**: Verify delete via Supabase dashboard or SQL before Phase 2 UI work.

---

## Phase 2: Settings page + danger zone UI

### Overview

Expose account deletion in the product with SSR stats, confirmation dialog, and navigation entry points.

### Changes Required:

#### 1. Protect settings route

**File**: `src/middleware.ts`

**Intent**: Require auth for `/settings` like dashboard and sets.

**Contract**:
- Add `"/settings"` to `PROTECTED_ROUTES` array (`4:4`)

#### 2. Settings page (SSR)

**File**: `src/pages/settings.astro`

**Intent**: Account settings shell with deletion stats loaded server-side.

**Contract**:
- Use same layout pattern as `dashboard.astro` (cosmic background, `Topbar`, container)
- `createClient` + redirect if no user (middleware already guards; double-check optional)
- Queries (owner-scoped via RLS):
  - Count sets: `.from("flashcard_sets").select("id", { count: "exact", head: true })`
  - Count cards: either second query on `flashcards` joined by owned sets, or embed `flashcards(count)` on sets and sum — prefer one round-trip if straightforward
- Pass `user.email`, `setCount`, `cardCount` into React island props
- Mount `AccountDangerZone` with `client:load`

#### 3. Account danger zone island

**File**: `src/components/account/AccountDangerZone.tsx`

**Intent**: Danger zone copy + `AlertDialog` + typed `DELETE` confirmation + API call.

**Contract**:
- Props: `email: string`, `setCount: number`, `cardCount: number`
- Static warning copy: permanent deletion, lists counts (“**N** sets and **M** flashcards”)
- Button “Delete account” opens `AlertDialog` (controlled `open` state)
- Inside dialog: short explanation, `<Input>` for confirmation text, `AlertDialogAction` disabled until input === `"DELETE"`
- On confirm: `fetch("/api/auth/delete-account", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) })`
- Parse JSON like `SetDashboardList` (`ok` / `message`); on success `window.location.href = "/"`; on error show inline banner in dialog or below danger zone
- Destructive styling: red/outline destructive buttons consistent with set delete (`SetDashboardList.tsx` `280:315`)
- `busy` state while request in flight; prevent double submit

#### 4. Topbar navigation

**File**: `src/components/Topbar.astro`

**Intent**: Link to settings from all authenticated layouts using Topbar.

**Contract**:
- Add `<a href="/settings">Settings</a>` in the logged-in `gap-3` flex between Sets and Sign out (`12:21`)

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Signed-in user opens `/settings` from Topbar; unsigned user redirected to sign-in
- Dialog shows correct set/card counts for test account
- Confirm disabled until `DELETE` typed; wrong text cannot submit
- Successful deletion redirects to `/`; signing in with old password fails
- Another user’s account and data remain intact

**Implementation Note**: Pause after manual pass before Phase 3 doc updates.

---

## Phase 3: Env wiring docs + regression checklist

### Overview

Document deployment secrets and run a short cross-feature smoke test so account deletion does not regress core flows.

### Changes Required:

#### 1. Deployment / local secrets note

**File**: `context/changes/account-deletion/change.md` (## Notes append)

**Intent**: Capture operator steps for enabling deletion in each environment.

**Contract**:
- Bullet: local — add `SUPABASE_SERVICE_ROLE_KEY` to `.dev.vars` (not committed)
- Bullet: production — `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
- Bullet: CI build does not require the key; production must have it or delete returns 503

#### 2. Manual regression checklist

**File**: `context/changes/account-deletion/change.md` (## Notes)

**Intent**: Repeatable smoke list for implementer/reviewer.

**Contract** — checkboxes for:
- Delete account with 0 sets / with sets+cards
- Post-delete: `/dashboard`, `/sets/*` redirect unauthenticated
- Sign-up with same email allowed (fresh account)
- Unrelated user: dashboard, set CRUD, SRS review, AI generate still work
- Delete account without service role configured shows user-visible error (503 message), no partial delete

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- All checklist items in `change.md` executed and ticked
- Wrangler secret documented and verified on target deploy environment (if deploying)

---

## Testing Strategy

### Unit Tests:

- None in repo for this slice.

### Integration Tests:

- Manual API + UI flow only.

### Manual Testing Steps:

1. Create test user with 2 sets and several cards; note counts.
2. Open `/settings` → verify counts match.
3. Delete account with typed `DELETE` → land on `/`, data gone in DB.
4. Sign in as second user → data unchanged.
5. Optional: call delete API without service role → 503, user still exists.

## Performance Considerations

- Single admin API call per deletion; count queries on settings page are two lightweight aggregates — acceptable for infrequent settings visits.

## Migration Notes

- No new SQL migration required for MVP (cascade already defined).
- If adding tables later that store `user_id`, use `references auth.users(id) on delete cascade` or handle in this route explicitly.

## References

- Roadmap S-06: `context/foundation/roadmap.md` (lines 161–172, 185)
- Schema cascade: `supabase/migrations/20260526211944_flashcard_schema.sql`
- Set delete API pattern: `src/pages/api/flashcard-sets/delete.ts`
- Set delete UI pattern: `src/components/sets/SetDashboardList.tsx`
- Auth sign-out: `src/pages/api/auth/signout.ts`
- Protected routes: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Service role env + delete-account API

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 8fbff63
- [x] 1.2 Build passes: `npm run build` — 8fbff63

#### Manual

- [x] 1.3 Authenticated POST with `{ "confirm": "DELETE" }` returns `{ ok: true }` and removes user + cascaded data — 8fbff63
- [x] 1.4 Invalid body, no session, and missing service role return 400 / 401 / 503 respectively — 8fbff63

### Phase 2: Settings page + danger zone UI

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 0238796
- [x] 2.2 Build passes: `npm run build` — 0238796

#### Manual

- [x] 2.3 Settings link, protected `/settings`, dialog with counts, typed DELETE gate, redirect after success — 0238796
- [x] 2.4 Second user data unchanged after first user deleted — 0238796

### Phase 3: Env wiring docs + regression checklist

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Regression checklist in `change.md` completed
- [ ] 3.4 Service role secret documented for local and production deploy
