# AI Generation Contract + Privacy Tests — Plan Brief

> Full plan: `context/changes/ai-generation-contract-privacy/plan.md`

## What & Why

Protect test-plan risks **#3** and **#4**: pasted source text must leave no trace in app-layer storage (responses, DB writes), and malformed/empty AI responses must surface safe errors — never false success. The generation feature shipped in S-02 without automated contract tests; this change adds the missing Vitest and Playwright coverage.

## Starting Point

- Generation flow: `FlashcardGenerator` → `POST /api/ai/generate` → OpenRouter → `validateFlashcardDrafts`; only Q+A persist on save.
- Vitest has 21 SRS-only tests; no generation tests. `vitest.config.ts` blocks `astro:env` without mocks.
- Playwright has auth redirect smoke and set lifecycle seed — no AI specs.

## Desired End State

`npm test` and `npm run test:e2e` prove: fixture malformed AI → safe `errorKey`; valid fixtures → usable cards; handler never echoes source text or calls `supabase.from`; Playwright shows error banner (not drafts) on API failure. Test-plan §6 AI cookbook row documents the pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Test layers | Vitest unit/service + Playwright API + E2E UI | Full stack coverage including rendered error state | Plan |
| E2E for Risk #4 UI | One Playwright spec in this change | Catches thin UI branch that only checks `body.ok` | Plan |
| API auth/input testing | Playwright `request.post` against running app | Real HTTP stack without Astro Container complexity | Plan |
| Privacy proof (Risk #3) | Vitest handler test: no text echo + no `supabase.from` | DB-write spy is natural in Vitest; avoids Supabase in CI | Plan |
| Fixture matrix size | Standard (7+ cases) | Covers real failure modes without mirroring parser line-by-line | Plan |
| Parsing testability | Extract `ai-response-parse.ts` | Pure functions testable without fetch/env | Plan |
| Phase count | 3 phases | Incremental commits: parsing → service → handler/Playwright | Plan |

## Scope

**In scope:**

- Extract `ai-response-parse.ts` and `ai-generate-handler.ts`
- Vitest: validation, parsing, OpenRouter service fixtures, handler privacy
- Playwright: API 401/400 contracts + E2E error UI with route mock
- Update test-plan §6 cookbook

**Out of scope:**

- Live OpenRouter in CI, Supabase connectivity probes, rate limits
- Full generator happy-path E2E, React component unit tests
- `console.error` content assertions

## Architecture / Approach

```
Vitest (no secrets)                    Playwright (running app)
├── flashcard-draft-validation.test     ├── request.post → 401/400
├── ai-response-parse.test              └── page + route mock → error UI
├── openrouter-generate.test (fetch stub)
└── ai-generate-handler.test (privacy spy)
```

Parsing and validation are pure. Service tests stub `fetch` + `astro:env`. Handler test mocks Supabase to prove no writes. Playwright intercepts client-side `/api/ai/generate` for UI; server-side OpenRouter stays mocked via Vitest.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Validation & parsing | Extract parse module + unit tests | Refactor changes behavior |
| 2. OpenRouter service | 7+ fixture matrix via stubbed fetch | `astro:env` mock fragility |
| 3. Handler + Playwright | Privacy handler test, API contract, E2E error UI | E2E flake on dashboard islands |

**Prerequisites:** Vitest bootstrapped (Phase 1 test-plan complete); Playwright infra in place (`playwright.config.ts`, auth setup).

**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- `vi.mock("astro:env/server")` may need Vitest alias tuning — fallback is env injection via extracted dependency.
- Playwright dashboard islands may need `expect().toPass()` retry pattern from seed spec.
- Handler extraction must be behavior-preserving — manual happy-path check in Phase 3.

## Success Criteria (Summary)

- Malformed AI fixtures always yield safe errors in Vitest; never empty success.
- Sentinel source text never appears in handler response JSON; `supabase.from` never called.
- Playwright: unauthenticated generate → 401; failed generate in UI → error banner, no drafts.
