# Unified paper UI (S-08) — Plan Brief

> Full plan: `context/changes/unified-paper-ui/plan.md`  
> Roadmap: `context/foundation/roadmap.md` (S-08)  
> Prerequisite: `context/changes/study-hub-ui/` (S-07, `impl_reviewed`)

## What & Why

After S-07, dashboard, landing, and set detail use the paper theme, but review, settings, and auth still use cosmic glass (`bg-cosmic`, `Topbar.astro`). Users see a jarring skin change when they open **Study**, **Settings**, or sign in. S-08 completes the visual system so every user-facing route shares `PaperShell`, `AppTopbar`, and paper tokens — without touching SRS, auth APIs, or schema.

## Starting Point

- **Paper (S-07):** `PaperShell.astro`, `AppTopbar.astro`, `.paper-theme` tokens in `global.css` on `/`, `/dashboard`, `/sets/<id>`.
- **Cosmic (remaining):** `review.astro`, `settings.astro`, `auth/*.astro` use `bg-cosmic` + `Topbar.astro`; React islands hardcode white/glass classes (`ReviewSession.tsx`, `FormField.tsx`, `AccountDangerZone.tsx`); `input.tsx` uses cosmic shadcn overrides.
- **Dual-theme precedent:** `FlashcardRow` already supports `theme="paper" | "cosmic"` (default `cosmic`).

## Desired End State

- Full navigation loop (landing → auth → dashboard → set → review → settings) stays on warm paper styling.
- SRS grading, sign-in/up POST, account deletion behave identically; only presentation changes.
- `Topbar.astro` removed; no `bg-cosmic` on user routes (`@utility bg-cosmic` may remain unused in CSS).
- `npm run lint` and `npm run build` pass; manual regression checklist in `change.md` completed.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| `bg-cosmic` on user routes | Remove; keep utility in CSS | Roadmap default; dev escape hatch only | Plan / User |
| Auth field styling | `theme="paper"` on shared auth components (mirror `FlashcardRow`) | Avoid broken inputs on paper shells | User |
| Phase order | Auth + settings → review → cleanup | Lower SRS risk; smoke account flows early | User / Roadmap |
| `input.tsx` | Restore shadcn token classes | `AccountDangerZone` + dialogs inherit `.paper-theme` vars | Plan |
| `FlashcardRow` default | `paper` | Review is in-scope; no cosmic consumer left | Plan |
| `Topbar.astro` | Delete after migration | Replaced by `AppTopbar` everywhere | Roadmap |
| SRS logic | No changes to `fetch`/`grade` in `ReviewSession` | Presentation-only slice | Roadmap |

## Scope

**In scope:**
- Routes: `/sets/<id>/review`, `/settings`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`
- React: `ReviewSession`, auth forms stack, `AccountDangerZone`, `FlashcardRow` default
- Shared: `FormField`, `PasswordToggle`, `ServerError`, `input.tsx` token fix
- Cleanup: delete `Topbar.astro`, grep `bg-cosmic` / cosmic class inventory

**Out of scope:**
- SRS algorithm, API routes, DB migrations, i18n PL, new features
- Automated tests (none in repo)
- Re-archiving S-07 (prerequisite met in code; archive is separate)

## Architecture / Approach

```
.paper-theme (global.css)
  → PaperShell + AppTopbar (Astro pages)
       → theme="paper" on React islands (auth, review, danger zone)
            → FormField / ReviewSession branch classes like FlashcardRow
```

Phase 1 inventories cosmic usage; Phase 2 migrates low-risk auth/settings; Phase 3 reskins review (no grading edits); Phase 4 deletes legacy topbar and verifies zero cosmic routes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Inventory & primitives | Cosmic grep doc, `input.tsx` tokens, `theme` on auth helpers | `input.tsx` regression on dialogs |
| 2. Auth & settings | Paper shells on auth + settings; `AccountDangerZone` paper | Account deletion confirm flow UX |
| 3. Review session | `review.astro` + `ReviewSession` paper; `FlashcardRow` default | Accidental SRS logic edit |
| 4. Legacy cleanup | Remove `Topbar.astro`, verify routes, regression checklist | Missed import of old topbar |

**Prerequisites:** S-07 paper foundation implemented (`study-hub-ui` `impl_reviewed`).

**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- shadcn `alert-dialog` on paper background may need spot-check contrast (settings delete modal).
- No Vitest — regression is manual per phase.
- `dev/paper-preview.astro` stays on paper (already migrated in S-07).

## Success Criteria (Summary)

- No visual hop between dashboard, review, settings, and auth.
- Study → grade → dashboard due counts still sync.
- Sign-in, sign-up, sign-out, account deletion unchanged functionally.
- Lint + build green.
