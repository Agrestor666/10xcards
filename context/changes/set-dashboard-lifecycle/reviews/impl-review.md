<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Set dashboard lifecycle (S-05)

- **Plan**: context/changes/set-dashboard-lifecycle/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-05-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Zod schema omits `.max(80)` on update name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/flashcard-sets/update.ts:10-13
- **Detail**: Plan specified `name: z.string().max(80)` then `validateFlashcardSetName`. Implementation uses `z.string()` only; validation messages for >80 chars come from `validateFlashcardSetName` instead of generic "Invalid request body." This was an intentional fix during manual API testing and is better UX.
- **Fix**: No change required — document as acceptable deviation in plan addendum, or add `.max(80)` back only if you want Zod to reject before business validator (redundant).
- **Decision**: SKIPPED — intentional deviation; better UX than plan

### F2 — Stale `card_count` until page refresh

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/sets/SetDashboardList.tsx:160-164
- **Detail**: `card_count` is SSR snapshot. If user adds cards on `/sets/<id>` then returns to dashboard without reload, list may still show `card_count === 0` and delete skips the confirmation modal. Cards are still cascade-deleted at DB level — no data loss, but UX guardrail is weaker than intended.
- **Fix A ⭐ Recommended**: Accept for MVP; document in change.md Notes as known limitation (refresh syncs count).
  - Strength: Matches plan's client_state scope; zero extra API calls.
  - Tradeoff: Rare edge case; modal copy can be wrong until refresh.
  - Confidence: HIGH — user confirmed manual flows on fresh dashboard loads.
  - Blind spot: Haven't measured how often users navigate set detail → dashboard without refresh.
- **Fix B**: On dashboard `visibilitychange` or focus, refetch counts (new API or SSR partial).
  - Strength: Accurate modal without full reload.
  - Tradeoff: New endpoint or heavier client logic; out of slice scope.
  - Confidence: MED — adds scope beyond S-05.
  - Blind spot: Performance on large set lists.
- **Decision**: FIXED via Fix A — documented in change.md Notes

### F3 — Mutation errors use list banner, not per-row inline

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/sets/SetDashboardList.tsx:177-180
- **Detail**: Plan asked for "inline error text for failed mutations." Rename validation shows inline under input; API failures use a single banner (same pattern as `SetFlashcardsManager`). Functionally clear; not per-row.
- **Fix**: Optional — map `errorMessage` to the active row id for inline display under that row's actions.
- **Decision**: SKIPPED

### F4 — `SetDashboardList.tsx` exceeds 200 lines without row split

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/sets/SetDashboardList.tsx
- **Detail**: File is ~318 lines. Plan optional split at `SetDashboardRow.tsx` when >200 lines was not done. Readability is still acceptable.
- **Fix**: Extract `SetDashboardRow` in a follow-up if the file grows further.
- **Decision**: SKIPPED

### F5 — Out-of-scope `fix(auth)` commit bundled in timeline

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: 9e5095f (fix(auth): password visibility toggle)
- **Detail**: Password toggle fix landed between Phase 2 commits; unrelated to S-05 but discovered during manual testing. Beneficial; no coupling to set lifecycle code.
- **Fix**: None required.
- **Decision**: SKIPPED

## Success criteria verification

| Check | Result |
|-------|--------|
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Progress manual items 1.3, 2.3, 3.3 | All `[x]` with user "manual OK" |

## Plan vs diff summary

| Planned | Status |
|---------|--------|
| `flashcard-set-errors.ts` update/delete mappers | MATCH |
| `api/flashcard-sets/update.ts`, `delete.ts` | MATCH |
| `alert-dialog.tsx` | MATCH (manual install via mirror registry) |
| `DashboardSetRow` type | MATCH |
| `SetDashboardList.tsx` | MATCH |
| `dashboard.astro` wire + count query | MATCH (wired in p2, polished in p3) |
| Generator SSR snapshot documented | MATCH (`change.md` + comment) |
| No rename/delete on `/sets/<id>` | MATCH |
| `load-set-detail` redirect for deleted sets | MATCH (unchanged, verified) |
