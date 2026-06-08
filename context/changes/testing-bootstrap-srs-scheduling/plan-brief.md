# Bootstrap + SRS Scheduling — Plan Brief

> Full plan: `context/changes/testing-bootstrap-srs-scheduling/plan.md`
> Research: `context/foundation/test-plan.md` (Phase 1, Risk #1)

## What & Why

The app's top user concern is SRS silently stopping — cards graded in the UI never come back for review. Test-plan Phase 1 bootstraps Vitest and adds unit tests that prove the real FSRS path updates `due_at`/`srs_state` and the due predicate correctly identifies when a card should reappear, without mocking `ts-fsrs`.

## Starting Point

Zero test files and no `npm test` script. SRS core already exists as pure lib modules (`grade-card.ts`, `fsrs-mapper.ts`, `scheduler.ts`). The due rule `due_at <= now` is duplicated in three files. Archived srs-review-session deferred the exact unit tests this change now implements.

## Desired End State

`npm test` runs Vitest and passes with colocated SRS tests beside `src/lib/srs/`. A shared `isFlashcardDue()` helper replaces duplicated due logic. Tests cover mapper roundtrip, all four ratings via real FSRS, and a lib-layer grade→due flow that would catch Risk #1 regressions before merge. CI gate (`ci-quality-gate`) can wire `npm test` once this lands.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Vitest config | Astro `getViteConfig()` | Official Astro pattern; shares Vite/`@/*` alias setup | Plan |
| Test location | Colocate beside source | Matches stack-assessment and archived srs plan intent | Plan |
| Due filter | Extract shared predicate | One source of truth; unit-testable without DB | Plan |
| Rating coverage | All four ratings | Full mapping coverage for `toFsrsRating` | Plan |
| Time strategy | Fixed UTC + relative asserts | Deterministic without brittle exact FSRS intervals | Plan |
| API tests | Defer to test-plan Phase 2 | No Supabase in CI; lib tests give Risk #1 signal cheapest | Research |
| FSRS mocking | Never mock ts-fsrs | Test-plan anti-pattern; real library is the signal | Research |

## Scope

**In scope:**
- Vitest install + `vitest.config.ts` + `npm test` script
- `is-due.ts` helper + wire `due.ts`, `load-dashboard-sets.ts`, `due-summary.ts`
- Colocated tests: mapper, grade service, due predicate, grade→due flow
- Test-plan §6 SRS cookbook row update

**Out of scope:**
- API route / Supabase integration tests (Phase 2)
- CI workflow changes (`ci-quality-gate`)
- React component or E2E tests
- Coverage reporting

## Architecture / Approach

```
npm test → Vitest (getViteConfig)
  └─ src/lib/srs/*.test.ts
       ├─ fsrs-mapper.test.ts   (DB ↔ Card roundtrip)
       ├─ grade-card.test.ts      (real ts-fsrs, 4 ratings)
       ├─ is-due.test.ts          (due predicate)
       └─ grade-due-flow.test.ts  (grade → isFlashcardDue)

Production due queries → dueAsOfIso(now) → .lte("due_at", …)
```

Pure lib tests — no Astro Container API, no Supabase, no HTTP.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Vitest bootstrap | `npm test` runs with smoke test | `@/*` alias misconfiguration breaks imports |
| 2. Due predicate extraction | Shared `isFlashcardDue` + wired call sites | Behavior drift if refactor changes lte semantics |
| 3. Mapper + grade tests | Real FSRS coverage for all ratings | Over-specifying exact due_at intervals → flaky tests |
| 4. Grade→due flow tests | End-to-end lib scenario for Risk #1 | Test-plan cookbook left stale if §6 not updated |

**Prerequisites:** Node v22.14.0; existing SRS implementation merged; no Supabase secrets needed.

**Estimated effort:** ~1–2 focused sessions across 4 phases.

## Open Risks & Assumptions

- `ci-quality-gate` must merge after this change — merging CI first breaks every run (`Missing script: test`).
- Exact FSRS intervals may shift on ts-fsrs patch bumps — tests use relative assertions only.
- API wiring (grade.ts calling gradeCard + persisting) remains unproven until test-plan Phase 2.

## Success Criteria (Summary)

- `npm test` passes with meaningful SRS tests (not just a smoke stub).
- Grading `"good"` on a due card yields `isFlashcardDue === false` at the same instant.
- All four ratings produce valid v1 `srs_state` without mocking FSRS.
- Due predicate lives in one module used by all three production call sites.
