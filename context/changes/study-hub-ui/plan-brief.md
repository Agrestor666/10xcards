# Study hub UI (S-07) — Plan Brief

> Full plan: `context/changes/study-hub-ui/plan.md`  
> PRD: `context/foundation/prd-v3.md`  
> Copy: `context/changes/study-hub-ui/landing-copy.md` (variant A)

## What & Why

After login, the dashboard still looks like a generic starter admin panel instead of a study app. S-07 turns `/dashboard` into a **study hub** (due today, **Study** on set tiles, paper theme) and aligns public landing (`/`) and set detail (`/sets/<id>`) with the same visual identity—without changing SRS logic, auth, or schema.

## Starting Point

- Dashboard: cosmic glass layout, dominant create form, row list with inline Edit/Delete, `FlashcardGenerator`, SSR `card_count` only (`src/pages/dashboard.astro`, `SetDashboardList.tsx`).
- Due semantics exist in `GET /api/srs/due` (`due_at <= now`) but are not shown on the dashboard.
- Landing: `Welcome.astro` still says “10x Astro Starter”.
- Set detail: cosmic styling; review session page unchanged in scope.

## Desired End State

- Logged-in user sees **total due today** + per-set due on tiles, starts review via **Study**, manages sets via **+ New set** and **⋯** menu.
- Visitor on `/` sees variant A hero + feature cards; signed-in flows unchanged.
- Set detail uses paper shell; CRUD + **Start review** work as today.
- `npm run lint` and `npm run build` pass; manual regression checklist completed.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Due count SSR | Second query on `flashcards` (`set_id` where `due_at <= now`), merge in TS | Same rule as `srs/due.ts`; no migration; RLS-safe | Plan |
| Due hero shape | Aggregate total in hero + per-set on tiles | Matches proposal “due today” metaphor | PRD / Plan |
| Due rule | `lte("due_at", nowIso)` | Identical to `src/pages/api/srs/due.ts:61` | Code |
| Paper fonts | DM Sans (body) + Instrument Serif (display) via `@fontsource` | Proposal direction; works on Workers | Plan |
| Set lifecycle UI | shadcn `dropdown-menu` + existing `AlertDialog` | ⋯ menu per shape; no inline Edit/Delete on tiles | Plan |
| Create set | `Dialog` + form POST to `/api/flashcard-sets/create` | Reuses existing API; no new endpoint | Plan |
| AI generator | `<details>` collapsed by default on dashboard | De-emphasize without new shadcn collapsible | Plan |
| Landing copy | Variant A in `landing-copy.md` | User choice 2026-05-30 | User |
| Theme scope | `/`, `/dashboard`, `/sets/<id>` only | Settings/auth/review stay cosmic this slice | PRD non-goals |
| Card sync event | Extend `DASHBOARD_SET_CARDS_ADDED` optional `dueAdded` or reload counts | New cards may be due immediately | Plan |

## Scope

**In scope:**
- Paper theme tokens + `PaperShell.astro` + shared `AppTopbar.astro`
- `load-dashboard-sets.ts`, dashboard study hub layout, tile grid, Study CTA
- `Welcome.astro` rebrand (variant A)
- `sets/[id]/index.astro` paper shell
- `DashboardSetRow.due_count`, generator collapsible, regression checklist

**Out of scope:**
- Review session UI (`/sets/<id>/review`)
- Settings / auth pages paper theme
- DB migrations, i18n PL, generator dropdown rename fix
- Automated tests (none in repo)

## Architecture / Approach

```
global.css (paper tokens + fonts)
    → PaperShell.astro + AppTopbar.astro
         → dashboard.astro (SSR: loadDashboardSets → StudyHero + SetDashboardGrid + Generator)
         → Welcome.astro (static copy from landing-copy.md)
         → sets/[id]/index.astro (paper shell, existing islands)

due_at rule: nowIso = new Date().toISOString()  (same as srs/due.ts)
```

## Phases at a Glance

| Phase | Delivers | Key risk |
| ----- | -------- | -------- |
| 1. Paper foundation | Tokens, fonts, shell, topbar | Token drift vs shadcn defaults |
| 2. Dashboard study hub | Due SSR, tiles, Study, + New set, ⋯ menu | Wrong due counts; broken `dashboard-set-sync` |
| 3. Landing + set detail | Welcome variant A, set page shell | Scope/time; review page visual hop |
| 4. Regression | Checklist in `change.md` | No Vitest—manual only |

**Prerequisites:** F-01, S-01, S-02, S-04, S-05 (implemented in repo).

**Estimated effort:** ~3–4 after-hours sessions across 4 phases (~3 weeks calendar with scope expanded).

## Open Risks & Assumptions

- Review page still cosmic until follow-up slice (accepted).
- Settings remains cosmic (minor hop from dashboard).
- No Vitest—regression is manual.
- `shadcn` `dropdown-menu` + `dialog` must be added (not in repo yet).

## Success Criteria (Summary)

- Dashboard shows due today and **Study** works per set.
- Landing + set detail match paper theme; preserved flows (AI save sync, rename/delete, CRUD) pass regression.
- Lint + build green.
