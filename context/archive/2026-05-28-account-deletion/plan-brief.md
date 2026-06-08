# Account deletion (S-06) — Plan Brief

> Full plan: `context/changes/account-deletion/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-06)

## What & Why

Users need a compliant way to permanently leave the product and erase their data. S-06 adds account deletion from settings: confirm intent, remove the Supabase Auth user, and let existing FK cascades delete all sets and flashcards — satisfying privacy/RODO expectations without soft-delete complexity.

## Starting Point

Auth (sign-in/up/out) and RLS-scoped flashcard data exist. Schema already cascades `auth.users` → `flashcard_sets` → `flashcards`. There is no settings page, no service role env var, and no admin delete API. Destructive UI patterns (JSON POST + `AlertDialog`) exist for set deletion on the dashboard.

## Desired End State

From `/settings`, a signed-in user sees how many sets and cards will be removed, confirms in a modal by typing `DELETE`, and is logged out on success. Their Auth record and all app rows are gone; they cannot access protected routes with the old session.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Complexity | MEDIUM | New secret, admin API, settings UI, security ordering | Plan |
| Delete mechanism | `auth.admin.deleteUser` + FK cascade | Anon client cannot delete users; schema cascades app data | Plan / Research |
| Confirmation UX | `AlertDialog` + type `DELETE` | Stronger than bare OK; roadmap default modal, no password in MVP | Roadmap / Plan |
| Data ordering | Delete auth user only | Manual set delete unnecessary with `ON DELETE CASCADE` | Roadmap / Schema |
| Settings location | `/settings` + Topbar link | Roadmap outcome says “account settings”; no page exists yet | Roadmap / Plan |
| API style | JSON POST `/api/auth/delete-account` | Matches flashcard mutation routes | Plan |
| Soft delete | Hard delete only | RODO erasure; roadmap explicitly no soft-delete in MVP | Roadmap |
| Service role scope | Single delete route only | Rest of app stays on anon + RLS | Plan |
| Prerequisites | F-01 only | Schema/RLS already in repo | Roadmap |

## Scope

**In scope:**
- `SUPABASE_SERVICE_ROLE_KEY` in Astro env schema + `.env.example`
- `src/lib/supabase-admin.ts` + `src/pages/api/auth/delete-account.ts`
- `/settings` page + `AccountDangerZone` React island
- Topbar link + middleware protection
- Manual regression checklist + deploy secret notes

**Out of scope:**
- Password re-entry, email confirmation link, data export
- Soft delete / recovery period
- Admin deletion of other users
- New SQL migration (cascade exists)
- Automated tests

## Architecture / Approach

```
/settings.astro (SSR: email, setCount, cardCount)
    → AccountDangerZone (client:load)
         → POST /api/auth/delete-account { confirm: "DELETE" }
              → session getUser() → admin.deleteUser(id)
              → CASCADE flashcard_sets, flashcards
              → signOut() → client redirect /
```

Service role client is never used outside the delete-account API route.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API + admin client | Env secret, delete endpoint, sign-out | Service role missing in prod → 503; must not leak key |
| 2. Settings UI | Page, dialog, nav, counts in copy | Wrong aggregate counts; double-submit |
| 3. Docs + regression | Wrangler/local secret notes, smoke list | Regressions on dashboard/SRS/AI if delete tested on shared env |

**Prerequisites:** F-01 (`data-schema-rls`) — schema and RLS in place.

**Estimated effort:** ~1–2 focused sessions across 3 phases.

## Open Risks & Assumptions

- Production and local dev must configure `SUPABASE_SERVICE_ROLE_KEY` or deletion returns 503 (fail closed).
- Future tables referencing `auth.users` must use `ON DELETE CASCADE` or be deleted in the API route.
- No Vitest — manual regression only.
- CI build may pass without service role; production deploy must set the secret.

## Success Criteria (Summary)

- User can delete account from `/settings` with typed `DELETE` confirmation.
- Auth user and all owned sets/cards are removed; session ends.
- Other users unaffected; lint and build pass.
