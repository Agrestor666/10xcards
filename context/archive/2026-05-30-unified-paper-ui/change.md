---
change_id: unified-paper-ui
title: Unified paper UI: review, settings, auth + full route audit
status: archived
created: 2026-05-30
updated: 2026-06-01
archived_at: 2026-06-01T20:10:29Z
---

## Notes

from @context/foundation/roadmap.md

### Cosmic inventory (Phase 1)

Baseline from `rg "bg-cosmic|Topbar\.astro|white/10|purple-300"` under `src/` before Phase 2.

| Route / area | Files still cosmic |
| ------------ | ------------------ |
| `/sets/<id>/review` | `src/pages/sets/[id]/review.astro`, `src/components/srs/ReviewSession.tsx` |
| `/settings` | `src/pages/settings.astro`, `src/components/account/AccountDangerZone.tsx` (section styling) |
| `/auth/signin`, `/auth/signup`, `/auth/confirm-email` | `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro` |
| Legacy nav | `src/components/Topbar.astro` (imported by review + settings) |
| Auth islands (cosmic default until Phase 2) | `FormField`, `PasswordToggle`, `ServerError` — `theme="paper"` wired in Phase 2 |
| Shared utility (retained, unused on pages after Phase 4) | `src/styles/global.css` (`@utility bg-cosmic`) |

**Already paper (S-07):** `dashboard.astro`, `Welcome.astro` (`/`), `sets/[id]/index.astro`, `PaperShell`, `AppTopbar`, `FlashcardRow` with `theme="paper"` on set detail / generator.

**Phase 1 primitives:** `src/components/ui/input.tsx` → shadcn tokens; `UiTheme` in `src/types.ts`; auth helpers accept optional `theme` (default `cosmic`).

### Cosmic inventory (Phase 4 — final)

Verified via `rg "Topbar\.astro" src/` and `rg "bg-cosmic" src/pages` after Phase 2–3 migrations.

| Check | Result |
| ----- | ------ |
| `@/components/Topbar.astro` imports | **None** — `Topbar.astro` deleted |
| `bg-cosmic` in `src/pages/**` | **None** |
| `theme="cosmic"` callers in `src/` | **None** |
| Intentional exception | `@utility bg-cosmic` in `global.css` (commented, unused on app routes) |

**All user-facing routes now paper:** `/`, `/dashboard`, `/sets/<id>`, `/sets/<id>/review`, `/settings`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`.

### Manual regression checklist (Phase 4)

Run end-to-end before archive or release. Tick when verified.

**Paper continuity**

- [x] Logged out `/`: paper shell, variant A headline, **Get started** → signup, **Sign in** → signin
- [x] Full loop: `/` → sign up/in → dashboard → set → review → settings → sign out → `/` (no cosmic flash)
- [x] Mobile-width: auth card and review grade grid do not overflow

**Auth**

- [x] `/auth/signin` and `/auth/signup`: readable fields, validation errors, successful sign-in redirect
- [x] `/auth/confirm-email` renders (DEV and prod copy modes smoke)
- [x] Footer cross-links (sign up ↔ sign in) use paper link styling

**Settings / account**

- [x] `/settings`: email, stats, danger zone on paper; `AppTopbar` Settings / Sets / Sign out work
- [x] Delete-account dialog: opens, confirm field readable, cancel works (do not complete deletion unless testing account-deletion change)

**Review SRS**

- [x] Dashboard **Study** → review: paper shell, show answer, grade **Again/Good**, card advances
- [x] Return dashboard: due counts decrease (dashboard-set-sync)
- [x] Empty due state: message + back link to set
- [x] Set detail **Start review**: same paper session; no console errors on fetch/grade failures (retry works)

**S-07 dashboard regression**

- [x] Due hero total matches sum of per-tile due counts (or both zero)
- [x] **Study** on tile opens review with expected due cards
- [x] **+ New set** dialog creates set; **⋯** rename/delete behave as S-05
- [x] AI generate + bulk save updates tile counts without full reload
- [x] Generator `<details>` collapsed by default; expands on paper background

**Out of scope / preserved APIs**

- [x] SRS algorithm, `/api/srs/due`, `/api/srs/grade` unchanged (behavior-only smoke via review flow)
- [x] Auth API and middleware unchanged (sign-in/out smoke)
- [x] No database or RLS changes this slice
