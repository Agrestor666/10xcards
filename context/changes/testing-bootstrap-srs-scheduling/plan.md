# Bootstrap + SRS Scheduling Tests Implementation Plan

## Overview

Bootstrap Vitest in this Astro 6 project and add colocated SRS unit tests that exercise the real `ts-fsrs` path — not mocks. Prove Risk #1 from `context/foundation/test-plan.md`: grading updates schedule fields and the due predicate correctly identifies when a card should reappear. API route and Supabase integration tests are explicitly deferred to test-plan Phase 2.

## Current State Analysis

- **No test runner:** `package.json` has no `test` script; zero `*.test.ts` / `*.spec.ts` files.
- **SRS core is pure and testable:** `grade-card.ts`, `fsrs-mapper.ts`, and `scheduler.ts` have no Supabase or Astro dependencies.
- **Due filter duplicated:** `due_at <= nowIso` appears in `src/pages/api/srs/due.ts`, `src/lib/load-dashboard-sets.ts`, and `src/pages/api/dashboard/due-summary.ts`.
- **Archived precedent:** `context/archive/2026-05-27-srs-review-session/plan.md` specified the same unit tests but deferred them; `ci-quality-gate` waits on this change for a working `npm test`.

### Key Discoveries:

- `gradeCard()` is the single grading entry point — `src/lib/srs/grade-card.ts:20-24`
- Persisted shape uses v1 `srs_state` envelope — `src/lib/srs/fsrs-mapper.ts:161-175`
- Empty/new cards use `srs_state: {}` and `due_at = now()` — schema default in `supabase/migrations/20260526211944_flashcard_schema.sql`
- Test-plan anti-pattern to avoid: mock entire FSRS and assert the mock was called — `context/foundation/test-plan.md:56`

## Desired End State

- `npm test` runs Vitest and passes locally and in CI (once `ci-quality-gate` merges).
- Colocated tests beside `src/lib/srs/` prove:
  1. Mapper roundtrip and validation (`{}` → empty card, v1 roundtrip).
  2. Each rating (`again` / `hard` / `good` / `easy`) produces valid persisted schedule via real FSRS.
  3. After grading, `isFlashcardDue()` reflects whether the card would appear in a due query.
- A shared due predicate module replaces duplicated `nowIso` / `lte` logic at three call sites.
- `context/foundation/test-plan.md` §6 SRS cookbook row can be updated with the concrete pattern name and file references.

## What We're NOT Doing

- API route tests (`grade.ts`, `due.ts`) — deferred to test-plan Phase 2 (auth + ownership).
- Supabase/RLS integration or local Supabase in CI — test-plan §7 negative space.
- React component tests (`ReviewSession.tsx`) — UI churn is not the Risk #1 signal.
- CI workflow changes — owned by `context/changes/ci-quality-gate/`.
- Mocking `ts-fsrs` or `scheduler.next()` — test-plan anti-pattern.
- E2E / browser tests.

## Implementation Approach

Use Astro's official `getViteConfig()` helper so Vitest shares the project's Vite/TypeScript setup including `@/*` path aliases. Keep Phase 1 tests on pure lib modules — no Astro Container API needed yet.

Extract a tiny `isFlashcardDue(dueAt, now)` helper plus `dueAsOfIso(now)` for Supabase queries so the due rule lives in one place and is unit-testable without a database.

Test time is frozen to fixed UTC instants; assertions compare relative outcomes (`due_at > now`, `isFlashcardDue(...) === false`) rather than exact FSRS interval values, keeping tests stable across ts-fsrs patch releases.

## Critical Implementation Details

**ISO string ordering:** Supabase due queries rely on `due_at <= nowIso` where both are ISO 8601 strings with timezone (`Z`). Lexicographic comparison matches chronological order for this format — the shared helper must preserve this contract (always use `.toISOString()` on the `now` side).

**Vitest install:** Use `npm install -D vitest` (project already has Vite 7 via Astro). Do not add `@vitest/coverage-v8` in Phase 1 — coverage is out of scope.

## Phase 1: Vitest Bootstrap

### Overview

Install Vitest, add config via Astro's `getViteConfig()`, and wire `npm test` so CI can consume it later.

### Changes Required:

#### 1. Dev dependency

**File**: `package.json`

**Intent**: Add Vitest as the test runner for this project.

**Contract**: `vitest` appears in `devDependencies`; `"test": "vitest run"` and optionally `"test:watch": "vitest"` added to `scripts`.

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Configure Vitest using Astro's Vite config so `@/*` imports resolve the same way as production code.

**Contract**:

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

#### 3. Smoke test stub

**File**: `src/lib/srs/scheduler.test.ts` (new, temporary — replaced in Phase 3)

**Intent**: Confirm Vitest runs and `@/` alias resolves before SRS tests land.

**Contract**: Single test asserting `scheduler` is defined (import from `@/lib/srs/scheduler`). Removed or expanded in Phase 3 — keep at least one passing test after all phases.

### Success Criteria:

#### Automated Verification:

- Dependencies install: `npm install`
- Tests run: `npm test` (passes with ≥1 test)
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `npm run test:watch` discovers tests on file save (if watch script added)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Due Predicate Extraction

### Overview

Centralize the due rule (`due_at <= now`) in one module and wire existing call sites to use it.

### Changes Required:

#### 1. Due predicate module

**File**: `src/lib/srs/is-due.ts` (new)

**Intent**: Single source of truth for "is this card due as of `now`?" matching production Supabase `lte` semantics.

**Contract**:
- `dueAsOfIso(now: Date): string` — returns `now.toISOString()` for Supabase `.lte("due_at", …)` calls.
- `isFlashcardDue(dueAt: string, now: Date): boolean` — returns `dueAt <= now.toISOString()`.

#### 2. Wire due endpoint

**File**: `src/pages/api/srs/due.ts`

**Intent**: Replace inline `new Date().toISOString()` with `dueAsOfIso(now)` for the due-card query and keep behavior identical.

**Contract**: Due query still uses `.lte("due_at", dueAsOfIso(now))`; no response shape changes.

#### 3. Wire dashboard loaders

**File**: `src/lib/load-dashboard-sets.ts`

**Intent**: Use shared due timestamp helper for dashboard SSR due counts.

**Contract**: `.lte("due_at", dueAsOfIso(now))` replaces inline `nowIso`.

**File**: `src/pages/api/dashboard/due-summary.ts`

**Intent**: Same due timestamp helper for client-side due-summary refresh.

**Contract**: Same `.lte` replacement; no API response changes.

#### 4. Predicate unit tests

**File**: `src/lib/srs/is-due.test.ts` (new)

**Intent**: Prove the due rule matches production expectations.

**Contract**: Tests cover: due_at equal to now → due; due_at before now → due; due_at after now → not due; timezone-bearing ISO strings only.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Review session still loads due cards; dashboard due counts unchanged after refactor (spot-check one set with due cards)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Mapper and Grade Service Tests

### Overview

Add colocated unit tests for FSRS mapping and grading using real `ts-fsrs` with fixed UTC timestamps.

### Changes Required:

#### 1. Mapper tests

**File**: `src/lib/srs/fsrs-mapper.test.ts` (new)

**Intent**: Guard DB ↔ FSRS conversion — the highest-value pure logic besides grading.

**Contract**:
- `{}` srs_state + valid `due_at` → `toFsrsCard` produces card with expected defaults.
- v1 `srs_state` roundtrip: `toFsrsCard` → `toPersistedSchedule` preserves stability, difficulty, reps, state, and ISO timestamps.
- Strict mode throws on invalid `due_at` (missing timezone) and malformed v1 fields.
- `toPersistedSchedule` always writes `srs_state.v === 1`.

Use fixed anchor: `const NOW = new Date("2026-06-08T12:00:00.000Z")`.

#### 2. Grade service tests

**File**: `src/lib/srs/grade-card.test.ts` (new)

**Intent**: Prove each user rating runs real FSRS and returns valid persisted schedule — the core Risk #1 protection.

**Contract**:
- Input: `{ due_at: NOW.toISOString(), srs_state: {} }`, `now: NOW`, each rating in `["again", "hard", "good", "easy"]`.
- Output: `due_at` is valid ISO with timezone; `srs_state.v === 1`; numeric fields are finite.
- Behavioral asserts (relative, not exact intervals):
  - `good`: `due_at > NOW.toISOString()` (card no longer due immediately).
  - `again`: `reps` increments or `lapses` increments; card remains due or rescheduled sooner than `good`.
- Do not mock `@/lib/srs/scheduler` or `ts-fsrs`.

#### 3. Retire smoke-only test

**File**: `src/lib/srs/scheduler.test.ts`

**Intent**: Either remove if redundant or fold scheduler import sanity into `grade-card.test.ts`.

**Contract**: No standalone trivial-only test file remains unless it adds unique coverage.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- None required — pure lib tests with no production behavior change in this phase.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Grade → Due Flow Tests

### Overview

Prove the end-to-end scheduling story at the lib layer: grade a due card, then verify `isFlashcardDue` reflects whether it would appear in a due query.

### Changes Required:

#### 1. Flow test module

**File**: `src/lib/srs/grade-due-flow.test.ts` (new)

**Intent**: Simulate the production path grade API + due query would take, without HTTP or Supabase.

**Contract**:
- **Scenario A — grade removes from due queue:** Start with `{ due_at: NOW, srs_state: {} }`. Call `gradeCard(…, NOW, "good")`. Assert `isFlashcardDue(result.due_at, NOW) === false`.
- **Scenario B — card stays due when due_at is now:** Ungraded card with `due_at: NOW.toISOString()` → `isFlashcardDue(…, NOW) === true`.
- **Scenario C — simulate due queue selection:** Given an array of `{ id, due_at, srs_state }`, filter with `isFlashcardDue` and sort by `due_at ASC`; after grading the earliest due card with `"good"`, assert it is absent from the filtered list and the next card (if any) is returned.
- **Scenario D — v1 state survives grade cycle:** Grade a card with realistic v1 state; assert roundtrip fields remain valid and due/not-due outcome is consistent.

Use the same fixed `NOW` anchor across scenarios.

#### 2. Test-plan cookbook sync

**File**: `context/foundation/test-plan.md`

**Intent**: Record the concrete SRS test pattern so Phase 2+ agents reuse it.

**Contract**: §6 SRS scheduling row updated from `TBD` to name the pattern (lib-layer grade + `isFlashcardDue` flow tests) and reference `src/lib/srs/*.test.ts`. §3 Phase 1 status → `planned` (or `implementing` once work starts — do not set `complete` until all phases land).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Confirm test count and scenario names in output clearly map to Risk #1 ("grade updates schedule; due query would return card when due")

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `is-due.test.ts` — due predicate edge cases (equal, before, after, timezone format).
- `fsrs-mapper.test.ts` — roundtrip, `{}` defaults, strict validation failures.
- `grade-card.test.ts` — all four ratings with real FSRS; relative due_at assertions.
- `grade-due-flow.test.ts` — grade → `isFlashcardDue` integration at lib layer.

### Integration Tests:

- None in this change. Phase 2 of test-plan (`testing-auth-ownership` or equivalent) adds API integration with auth contexts.

### Manual Testing Steps:

1. After Phase 2 refactor: open review session, confirm due cards still load; grade one card, confirm it leaves the queue.
2. After Phase 4: read `npm test` output and confirm scenario names match Risk #1 acceptance criteria from test-plan.

## Performance Considerations

- Vitest runs only `src/**/*.test.ts` — no Astro build per test file.
- Pure lib tests execute in milliseconds; no network or DB I/O.
- FSRS `next()` is cheap; four rating cases × a few scenarios is negligible.

## Migration Notes

- No database migrations.
- Due predicate extraction is behavior-preserving refactor — same `lte` semantics, shared helper.
- Existing cards and schedules unaffected.

## References

- Test plan (Risk #1, Phase 1): `context/foundation/test-plan.md`
- Archived SRS implementation + deferred tests: `context/archive/2026-05-27-srs-review-session/plan.md`
- FSRS mapping notes: `context/archive/2026-05-27-srs-review-session/ts-fsrs.md`
- CI gate dependency: `context/changes/ci-quality-gate/plan-brief.md`
- SRS core: `src/lib/srs/grade-card.ts`, `src/lib/srs/fsrs-mapper.ts`
- Due endpoints: `src/pages/api/srs/due.ts`, `src/pages/api/srs/grade.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vitest Bootstrap

#### Automated

- [x] 1.1 Dependencies install: `npm install` — 154a165
- [x] 1.2 Tests run: `npm test` (passes with ≥1 test) — 154a165
- [x] 1.3 Lint passes: `npm run lint` — 154a165
- [x] 1.4 Build passes: `npm run build` — 154a165

#### Manual

- [x] 1.5 `npm run test:watch` discovers tests on file save (if watch script added) — 154a165

### Phase 2: Due Predicate Extraction

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 4aaf147
- [x] 2.2 Lint passes: `npm run lint` — 4aaf147
- [x] 2.3 Build passes: `npm run build` — 4aaf147

#### Manual

- [x] 2.4 Review session still loads due cards; dashboard due counts unchanged after refactor — 4aaf147

### Phase 3: Mapper and Grade Service Tests

#### Automated

- [x] 3.1 Unit tests pass: `npm test` — 795456f
- [x] 3.2 Lint passes: `npm run lint` — 795456f
- [x] 3.3 Build passes: `npm run build` — 795456f

#### Manual

- [x] 3.4 None required — pure lib tests with no production behavior change in this phase — 795456f

### Phase 4: Grade → Due Flow Tests

#### Automated

- [x] 4.1 Unit tests pass: `npm test` — 57a76ba
- [x] 4.2 Lint passes: `npm run lint` — 57a76ba
- [x] 4.3 Build passes: `npm run build` — 57a76ba

#### Manual

- [x] 4.4 Confirm test output scenario names map to Risk #1 acceptance criteria — 57a76ba
