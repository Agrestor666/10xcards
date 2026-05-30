---
change_id: unified-paper-ui
title: Unified paper UI: review, settings, auth + full route audit
status: implementing
created: 2026-05-30
updated: 2026-05-30
archived_at: null
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
