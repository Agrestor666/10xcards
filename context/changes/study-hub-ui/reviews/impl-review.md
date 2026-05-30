<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Study hub UI (S-07)

- **Plan**: context/changes/study-hub-ui/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification (re-run 2026-05-30)

| Check | Result |
|-------|--------|
| `npm run lint` | PASS (exit 0) |
| `npm run build` | PASS (exit 0) |

## Findings

### F1 — Due query failure hides successfully loaded sets

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/load-dashboard-sets.ts:38-39
- **Detail**: When the second query (`flashcards` due rows) fails, the loader returns `{ sets: [], error }` even though `flashcard_sets` already loaded. Dashboard shows a full failure with no grid or hero.
- **Fix**: On `dueError`, return mapped sets with `due_count: 0` and `totalDue: 0`, plus a distinct softer message (e.g. “Due counts unavailable”) so the set list remains usable.
  - Strength: Preserves primary dashboard function when only the auxiliary due query fails.
  - Tradeoff: Hero/tiles may show 0 due while counts are unknown — better than blank dashboard.
  - Confidence: HIGH — small, localized change in one file.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix now — graceful degrade + `dueCountsWarning` banner)

### F2 — Due counts fetched as one row per card

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/load-dashboard-sets.ts:36-45
- **Detail**: Due aggregation selects every due `set_id` row with no limit. Card counts use PostgREST `count`; due counts do not. Large due queues increase SSR payload and client-side reduce work. Plan explicitly accepts this for MVP.
- **Fix**: Document as known scale limit; defer grouped count (RPC/view) until user scale warrants it.
  - Strength: Matches plan intent; no premature migration.
  - Tradeoff: Performance cliff at high due volume.
  - Confidence: HIGH — plan and PRD scope align.
  - Blind spot: Haven't measured typical due row counts in production.
- **Decision**: SKIPPED (MVP scale limit accepted per plan)

### F3 — Hero copy says “today” but filter is “due now”

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/StudyHero.tsx (~49)
- **Detail**: Copy uses “cards due today” while `due_at <= now()` includes all overdue cards (same as `/api/srs/due`). Not wrong for SRS, but wording may confuse.
- **Fix**: Change copy to “ready to review” / “due now” or add calendar-day filter if product requires strict “today”.
- **Decision**: FIXED (copy → “ready to review”)

### F4 — Generator still shown when sets fail to load

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:52-57
- **Detail**: On `setsLoadError`, hero and grid are hidden but AI generator `<details>` still renders with empty `sets`.
- **Fix**: Wrap generator in `{!setsLoadError && (...)}` or show disabled state with explanation.
- **Decision**: FIXED (hide generator on fatal load error)

### F5 — Dashboard due counts stale after review until refresh

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/SetDashboardGrid.tsx (event sync)
- **Detail**: Live sync after AI save/delete works; returning from review does not update hero/tile due counts without reload. Documented as acceptable for this slice.
- **Fix**: Defer — add review-complete event or visibility refetch in follow-up.
- **Decision**: FIXED (review-graded event + due-summary API + bfcache pageshow refresh)
