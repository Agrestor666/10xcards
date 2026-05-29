<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Study hub UI (S-07) — Phase 2

- **Plan**: context/changes/study-hub-ui/plan.md
- **Scope**: Phase 2 of 4
- **Date**: 2026-05-29
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Planned shadcn dropdown-menu and dialog not installed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence / Pattern Consistency
- **Location**: src/components/dashboard/SetDashboardGrid.tsx:50-127,336-381; src/components/dashboard/NewSetDialog.tsx:46-80
- **Detail**: Phase 2 §5 specified `npx shadcn@latest add dropdown-menu dialog`. Neither component exists under `src/components/ui/`. The ⋯ menu is a hand-rolled `SetTileMenu` popover; rename and new-set modals use native `<dialog>`. Functionality matches plan intent but diverges from specified UI primitives and lacks built-in keyboard/focus management.
- **Fix A ⭐ Recommended**: Install shadcn `dropdown-menu` and `dialog`; refactor `SetTileMenu`, rename dialog, and `NewSetDialog` to use them.
  - Strength: Matches plan and repo shadcn conventions (`alert-dialog`, `button`, `input` already in use); gains Escape/arrow-key/focus-trap behavior.
  - Tradeoff: Moderate refactor (~3 components); may need Radix peer deps.
  - Confidence: HIGH — plan explicitly required this; pattern exists elsewhere in repo.
  - Blind spot: Haven't verified shadcn CLI install succeeds in this environment (Phase 1 had npm SSL issues).
- **Fix B**: Document deviation in plan addendum; keep native `<dialog>` and custom menu.
  - Strength: Zero rework; native dialog is lightweight and works.
  - Tradeoff: Pattern inconsistency; manual a11y gaps remain; plan ground truth drifts.
  - Confidence: MEDIUM — acceptable for MVP if a11y tested manually.
  -   Blind spot: Keyboard-only users not verified.
- **Decision**: FIXED via Fix A (shadcn components added manually due to npm SSL; deps in package.json)

### F2 — StudyHero totalDue stale after set delete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/SetDashboardGrid.tsx:260-261; src/components/dashboard/StudyHero.tsx:6-20
- **Detail**: `SetDashboardGrid.deleteSet` removes the tile locally but does not notify `StudyHero`. The hero aggregate due count stays inflated until full page reload. Card-add sync works via `DASHBOARD_SET_CARDS_ADDED`; delete has no symmetric event.
- **Fix**: Extend `dashboard-set-sync.ts` with a `dashboard-set-deleted` event (payload: `{ setId, dueCount }`); dispatch from `deleteSet` after success; subscribe in `StudyHero` to decrement `totalDue`.
- **Decision**: FIXED

### F3 — Benign scope extras (StudyHero, FlashcardRow theme)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/dashboard/StudyHero.tsx; src/components/flashcards/FlashcardRow.tsx
- **Detail**: `StudyHero.tsx` extracts hero logic from `dashboard.astro` (not named in plan but clean separation). `FlashcardRow.tsx` gains `theme: "cosmic" | "paper"` to support generator paper styling — reasonable extension of Phase 2 §7 generator work.
- **Fix**: No action required; optionally note extraction in plan addendum.
- **Decision**: FIXED — plan addendum added
