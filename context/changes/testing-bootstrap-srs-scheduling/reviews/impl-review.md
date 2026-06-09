<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bootstrap + SRS Scheduling Tests

- **Plan**: context/changes/testing-bootstrap-srs-scheduling/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Vitest config diverges from planned getViteConfig()

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: vitest.config.ts:1-14
- **Detail**: Plan specified Astro `getViteConfig()` for shared Vite/alias setup. Implementation uses standalone `defineConfig` from `vitest/config` with a manual `@` path alias. This was a necessary adaptation during Phase 1: `getViteConfig()` pulled in the Cloudflare adapter and failed with `resolve.external` incompatibility. Functionally correct for current pure-lib SRS tests; may need revisiting before tests import `astro:env`, React islands, or other Astro plugins.
- **Fix A ⭐ Recommended**: Add a brief comment in `vitest.config.ts` documenting the Cloudflare conflict and the trigger to revisit `getViteConfig()`.
  - Strength: Preserves working config; future agents won't "fix" it back to a broken state.
  - Tradeoff: Plan text remains slightly stale until addendum.
  - Confidence: HIGH — failure was reproduced and fixed in Phase 1.
  - Blind spot: Haven't re-tested whether newer Astro/Vitest versions resolve the conflict.
- **Fix B**: Retry `getViteConfig()` with Cloudflare plugin exclusions when Astro-dependent tests are added.
  - Strength: Aligns with plan's long-term intent.
  - Tradeoff: May still fail today; blocks on plugin compatibility research.
  - Confidence: LOW — original error was environment-specific.
  - Blind spot: Current Astro/Cloudflare/Vitest version matrix not re-checked.
- **Decision**: FIXED via Fix A

### F2 — test-plan §4 test-base profile still says "none"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/test-plan.md:85
- **Detail**: §4 row "Test-base profile" still reads `none — 0 test files, no runner config` while §4 "Test runner" row was updated to Vitest and the repo has 21 tests in 4 files. Phase 4 contract only required §3 + §6 updates; this line is stale metadata.
- **Fix**: Update line 85 to `vitest — 21 tests in src/lib/srs/*.test.ts` (or similar).
- **Decision**: FIXED

### F3 — againDueSooner assertion uses lexicographic fallback

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/srs/grade-card.test.ts:48
- **Detail**: `againDueSooner` uses `isFlashcardDue(...) || againResult.due_at <= goodResult.due_at`. The string comparison fallback could mask a regression if FSRS ever schedules "again" beyond "good" but lexicographically earlier. For new cards at NOW, `isFlashcardDue(againResult.due_at, NOW)` alone is the stronger signal aligned with Risk #1.
- **Fix**: Assert only `isFlashcardDue(againResult.due_at, NOW)` for the new-card case (drop the `||` fallback).
- **Decision**: DISMISSED — FSRS "again" can schedule slightly after NOW; OR fallback is correct per plan contract. Added clarifying comment instead.
