---
change_id: account-deletion
title: Account deletion (S-06)
status: impl_reviewed
created: 2026-05-28
updated: 2026-05-29
archived_at: null
---

## Notes

S-06 from @context/foundation/roadmap.md

### Service role (`SUPABASE_SERVICE_ROLE_KEY`)

Account deletion calls `auth.admin.deleteUser` via `src/lib/supabase-admin.ts`. The key must never be committed or exposed to the client bundle.

- **Local (Cloudflare dev):** Add `SUPABASE_SERVICE_ROLE_KEY` to `.dev.vars` (gitignored). For local Supabase, run `npx supabase status` and copy the **Secret** value from the Authentication Keys table (this is the service role JWT, not a user ID).
- **Local (Node / `.env`):** Same variable in `.env` if you run Astro outside Wrangler; see `.env.example`.
- **Production:** `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (paste the production project's service role key from Supabase Dashboard → Project Settings → API).
- **CI:** GitHub Actions build does **not** require this key (optional in `astro.config.mjs`). Production **must** have it or `POST /api/auth/delete-account` returns 503 with a user-visible configuration message and no user is deleted.

### Regression checklist (manual)

Run after Phase 1–2 land or before release. Tick when verified.

- [x] Delete account with **0 sets** — succeeds, redirects to `/`, user gone in Auth
- [x] Delete account with **sets + flashcards** — counts on `/settings` match; data cascaded away in DB
- [x] Post-delete: `/dashboard` and `/sets/*` redirect unauthenticated user to sign-in
- [x] **Sign-up** with same email allowed (fresh account, no orphaned app rows)
- [x] **Unrelated user:** dashboard, set CRUD, SRS review, AI generate still work
- [x] Delete without service role configured — UI/API shows 503 message; user and data remain intact

### Addendum (Phase 3 regression, commit `383841a`)

During regression testing, dashboard set **card counts** did not update after saving from the generator (separate React islands). Fixed with `src/lib/dashboard-set-sync.ts` (`CustomEvent`) wired in `FlashcardGenerator.tsx` and `SetDashboardList.tsx`. Out of original S-06 scope; no impact on account deletion.
