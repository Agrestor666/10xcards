# AI Generation Contract + Privacy Tests Implementation Plan

## Overview

Add automated coverage for test-plan Phase 3 risks **#3** (pasted source text leaves no trace in app-layer storage) and **#4** (malformed/empty AI responses surface safe errors, never false success). Deliver Vitest unit/service tests with fixture OpenRouter responses, a thin extracted generate handler for privacy proof, Playwright API contract tests for auth/input boundaries, and one Playwright E2E test for UI error display on failed generation.

## Current State Analysis

- **Generation path exists:** `FlashcardGenerator` → `POST /api/ai/generate` → `generateFlashcardsFromText` → `validateFlashcardDrafts`; save path persists only `question`/`answer` via `bulk-create`.
- **No generation tests:** Vitest suite is SRS-only (4 files, 21 tests). Playwright has auth redirect smoke and seed set lifecycle — no AI flow.
- **Vitest constraint:** `vitest.config.ts` uses standalone config without `astro:env`; `openrouter-generate.ts` imports `OPENROUTER_API_KEY` from `astro:env/server`.
- **Privacy by design:** `flashcards` schema has no source-text column; `generate.ts` performs no Supabase writes. DEV-only `console.error` in OpenRouter module may log LLM envelope on shape mismatch — not raw paste.
- **Archived precedent:** `context/archive/2026-05-27-ai-generation-save/plan.md` specified contract tests but never implemented them.

### Key Discoveries:

- Validation entry point — `src/lib/flashcard-draft-validation.ts:52-75`
- OpenRouter orchestration — `src/lib/openrouter-generate.ts:66-142`
- API route auth + input gates — `src/pages/api/ai/generate.ts:16-66`
- UI checks `body.ok`, not HTTP status — `src/components/generator/FlashcardGenerator.tsx:104-131`
- Generator lives on `/dashboard` — `src/pages/dashboard.astro:70`
- Test-plan anti-patterns: assert prompt without checking writes; mirror parser in assertions — `context/foundation/test-plan.md:58-59`

## Desired End State

- `npm test` includes generation contract tests that pass in CI without `OPENROUTER_API_KEY` or Supabase secrets.
- **Risk #4:** Fixture matrix proves valid LLM JSON → usable cards; malformed/empty/oversize/timeout/HTTP-error paths → `{ ok: false, errorKey }` — never `{ ok: true, cards: [] }`.
- **Risk #3:** Handler test proves generate response JSON never echoes sentinel source text and `supabase.from` is never invoked during generate.
- **Playwright:** Authenticated `request.post` proves 401/400 contracts; E2E proves error banner visible and no draft cards when `/api/ai/generate` returns failure.
- `context/foundation/test-plan.md` §6 AI generation cookbook row updated with concrete pattern and file references.

## What We're NOT Doing

- Real OpenRouter calls in CI or local automated runs — test-plan §7 negative space (platform contract).
- Supabase connectivity probes or post-hoc DB queries for sentinel text — deferred per user decision (Vitest mock instead).
- Full generator happy-path E2E with live AI — out of scope; manual only.
- Rate limiting tests — deferred since original S-02 implementation.
- React component unit tests for `FlashcardGenerator` — E2E covers the thin UI branch.
- `console.error` content assertions — privacy depth stops at response + no DB writes.
- Auth/ownership API matrix beyond generate route — owned by `testing-auth-ownership-boundaries`.

## Implementation Approach

**Layer 1 (Vitest, pure):** Extract LLM JSON parsing into `ai-response-parse.ts`; unit-test parsing and `validateFlashcardDrafts` with independent fixtures (not values copied from parser implementation).

**Layer 2 (Vitest, service):** Test `generateFlashcardsFromText` with `vi.stubGlobal("fetch", …)` returning seven standard OpenRouter envelope fixtures and `vi.mock("astro:env/server")` for API key injection.

**Layer 3 (Vitest handler + Playwright):** Extract `handleAiGenerateRequest(deps)` from the Astro route; Vitest proves privacy (no text echo, no `supabase.from` calls). Playwright `request` fixture proves HTTP auth/input contracts against the running app. Playwright page test route-mocks `/api/ai/generate` for UI error display — client-side fetch is interceptable; server-side OpenRouter is not.

## Phase 1: Validation & Parsing Unit Tests

### Overview

Establish the cheapest high-signal tests and extract pure parsing helpers so malformed LLM payloads are testable without fetch or `astro:env`.

### Changes Required:

#### 1. Extract LLM response parsing

**File**: `src/lib/ai-response-parse.ts` (new)

**Intent**: Move `extractJsonPayload` and `parseCardsFromLlmPayload` out of `openrouter-generate.ts` into a pure module with no env or network dependencies.

**Contract**: Exports `extractJsonPayload(content: string): unknown` (handles markdown-fenced JSON) and `parseCardsFromLlmPayload(payload: unknown): FlashcardDraft[] | null` (accepts bare array or `{ cards: [...] }` shape). `openrouter-generate.ts` imports from this module; behavior unchanged.

#### 2. Draft validation tests

**File**: `src/lib/flashcard-draft-validation.test.ts` (new)

**Intent**: Prove `validateFlashcardDrafts` and `validateFlashcardDraft` enforce trim, drop-empty, fail-fast on `max_chars`, and return `no_valid` when all cards are empty — the server-side guard against false success.

**Contract**: Tests cover: single valid card; empty question/answer dropped then `no_valid`; oversize field → `{ ok: false, key: "max_chars" }`; mixed valid+empty → subset returned. Use limits from `ai-generation-limits.ts`. Describe blocks reference Risk #4.

#### 3. Parsing helper tests

**File**: `src/lib/ai-response-parse.test.ts` (new)

**Intent**: Prove JSON extraction and card-array parsing handle real malformed LLM shapes independently of OpenRouter fetch.

**Contract**: Fixtures include: valid wrapped object; valid bare array; markdown-fenced JSON; invalid JSON string (throws); wrong top-level shape → `null`; empty array → `null` per schema min(1).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test -- src/lib/flashcard-draft-validation.test.ts src/lib/ai-response-parse.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- No production behavior change visible in dashboard generate flow (refactor-only extraction)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: OpenRouter Service Contract (Fixture Matrix)

### Overview

Test `generateFlashcardsFromText` end-to-end in the lib layer with stubbed fetch — seven standard fixtures covering Risk #4 failure modes without live OpenRouter.

### Changes Required:

#### 1. OpenRouter service tests

**File**: `src/lib/openrouter-generate.test.ts` (new)

**Intent**: Prove the service maps fixture OpenRouter HTTP responses to correct `GenerateFlashcardsResult` outcomes.

**Contract**: Mock `astro:env/server` with `OPENROUTER_API_KEY: "test-key"`. Stub `global.fetch` per test. Standard fixture matrix (7 cases):

| # | Fixture | Expected result |
|---|---------|-----------------|
| 1 | Valid wrapped `{ cards: [{question, answer}] }` | `{ ok: true, cards: [...] }` |
| 2 | Valid bare array | `{ ok: true, cards: [...] }` |
| 3 | Markdown-fenced JSON in `message.content` | `{ ok: true, cards: [...] }` |
| 4 | Invalid JSON in `message.content` | `{ ok: false, errorKey: "generator.error.generate" }` |
| 5 | Wrong shape (e.g. `{ items: [] }`) | `{ ok: false, errorKey: "generator.error.generate" }` |
| 6 | All-empty card pairs after trim | `{ ok: false, errorKey: "generator.error.no_valid_drafts" }` |
| 7 | One card exceeds `MAX_CARD_FIELD_CHARS` | `{ ok: false, errorKey: "generator.error.generate" }` |
| 8 | HTTP 500 response | `{ ok: false, errorKey: "generator.error.generate" }` |
| 9 | AbortError (timeout) | `{ ok: false, errorKey: "generator.error.timeout" }` |
| 10 | Missing API key (env mock returns undefined) | `{ ok: false, errorKey: "generator.error.generate" }` |

Assert outcome shape and `errorKey` only — do not assert internal parse steps. Describe blocks reference Risk #4.

#### 2. Shared fixture helpers (optional)

**File**: `src/lib/test-fixtures/openrouter-envelopes.ts` (new, if matrix becomes verbose)

**Intent**: Centralize OpenRouter response envelope builders so fixtures stay readable and independent of parser internals.

**Contract**: Export factory functions returning `Response` or JSON bodies matching OpenRouter chat completion shape. Used only by tests.

### Success Criteria:

#### Automated Verification:

- Service tests pass: `npm test -- src/lib/openrouter-generate.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- Deliberate break check: temporarily return `{ ok: true, cards: [] }` on empty validation — confirm a service test goes red, then revert

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Handler Privacy + Playwright API & E2E

### Overview

Prove Risk #3 at the handler boundary (no source text echo, no DB writes) and add Playwright coverage for HTTP auth/input contracts plus UI error display on failed generation.

### Changes Required:

#### 1. Extract generate handler

**File**: `src/lib/ai-generate-handler.ts` (new)

**Intent**: Make generate route logic testable with injectable dependencies without Astro runtime.

**Contract**: Export `handleAiGenerateRequest(input: { locale, supabase, body, generateFlashcardsFromText })` returning `{ status, body }` mirroring current `generate.ts` behavior. `src/pages/api/ai/generate.ts` becomes a thin wrapper delegating to this handler.

#### 2. Handler privacy tests

**File**: `src/lib/ai-generate-handler.test.ts` (new)

**Intent**: Prove Risk #3 — pasted source text never appears in response JSON and generate performs no Supabase data writes.

**Contract**: Use a distinctive sentinel string as input `text`. Mock `generateFlashcardsFromText` to return success. Mock `supabase` with `auth.getUser` returning a user and a spy on `from()` that records calls. Assert: response `JSON.stringify(body)` does not contain sentinel; `supabase.from` was never called. Additional cases: error response also excludes sentinel; unauthenticated → 401 without calling generate.

#### 3. Playwright API contract spec

**File**: `e2e/ai-generate-api-contract.spec.ts` (new)

**Intent**: Prove HTTP-level auth and input validation on the real running app via Playwright `request` fixture.

**Contract**: Uses `chromium` project (authenticated `storageState`). Tests:
- Guest `request.post("/api/ai/generate", { data: { text: "hello" } })` → 401
- Authenticated empty/whitespace text → 400
- Authenticated over-max text → 400
- Response bodies on 400 never include raw over-max text substring (privacy at boundary)

Provenance header links to test-plan Risk #5 input gates and Risk #3 response shape. Follow `e2e/E2E-RULES.md` and `e2e/seed.spec.ts` conventions.

#### 4. Playwright E2E UI error spec

**File**: `e2e/ai-generate-error-ui.spec.ts` (new)

**Intent**: Prove Risk #4 UI branch — when generate API returns failure, user sees error banner and no draft cards appear (no false success).

**Contract**: Authenticated test navigates to `/dashboard`, fills source textarea with unique text, `page.route("**/api/ai/generate")` returns `{ ok: false, errorKey: "generator.error.generate" }` with 502. Assert: destructive error alert visible; no generated card draft rows/inputs visible; Generate button returns to idle (not stuck generating). One test per file. Provenance header links Risk #4 and seed exemplar.

#### 5. Playwright config (if needed)

**File**: `playwright.config.ts`

**Intent**: Ensure new specs run under the `chromium` project with auth setup dependency.

**Contract**: New specs match existing `chromium` project `testIgnore`/`testMatch` rules — no guest project assignment unless a guest API test is added.

#### 6. Update test-plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Record the concrete AI generation test pattern once Phase 3 lands.

**Contract**: §6 AI generation row status `active` with file references (validation, service fixtures, handler privacy, Playwright specs).

### Success Criteria:

#### Automated Verification:

- Handler tests pass: `npm test -- src/lib/ai-generate-handler.test.ts`
- Full Vitest suite passes: `npm test`
- Playwright specs pass: `npx playwright test e2e/ai-generate-api-contract.spec.ts e2e/ai-generate-error-ui.spec.ts`
- Lint passes: `npm run lint`

#### Manual Verification:

- Paste short text on `/dashboard` with valid OpenRouter key — happy path still works (no regression from handler extraction)
- E2E deliberate break: route mock returns `{ ok: true, cards: [] }` — confirm UI spec goes red, then revert
- Confirm no raw pasted text in browser Network tab response for real generate call (manual spot check)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `flashcard-draft-validation.test.ts` — trim, drop empty, max_chars fail-fast, no_valid
- `ai-response-parse.test.ts` — fenced JSON, array vs wrapped, malformed shapes
- `ai-generate-handler.test.ts` — privacy sentinel, no supabase.from, auth gate

### Integration / Service Tests:

- `openrouter-generate.test.ts` — seven+ fixture matrix with stubbed fetch (no live OpenRouter)

### E2E Tests:

- `ai-generate-api-contract.spec.ts` — Playwright request auth/input HTTP contracts
- `ai-generate-error-ui.spec.ts` — route-mocked failure → error banner, no drafts

### Manual Testing Steps:

1. Sign in, open `/dashboard`, paste text within limit, generate with valid API key — cards appear.
2. Remove/misconfigure OpenRouter key — user-safe error, no cards, no source text in response.
3. Inspect Network response for `/api/ai/generate` — no `text` field echoed on success or error.

## Performance Considerations

- All Vitest tests run in Node with mocked fetch — sub-second suite addition expected.
- Playwright E2E uses route mock — no OpenRouter latency; two specs add minimal CI time.

## Migration Notes

- No schema migrations. Handler extraction is behavior-preserving refactor.
- CI `npm test` job unchanged (Vitest only); Playwright remains separate `test:e2e` unless CI wiring is added later.

## References

- Test plan: `context/foundation/test-plan.md` — Phase 3, risks #3, #4
- Archived feature plan: `context/archive/2026-05-27-ai-generation-save/plan.md`
- SRS test precedent: `context/archive/2026-06-08-testing-bootstrap-srs-scheduling/plan.md`
- E2E levers: `e2e/seed.spec.ts`, `e2e/E2E-RULES.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Validation & Parsing Unit Tests

#### Automated

- [x] 1.1 Unit tests pass: `npm test -- src/lib/flashcard-draft-validation.test.ts src/lib/ai-response-parse.test.ts` — 3cdb075
- [x] 1.2 Full suite passes: `npm test` — 3cdb075
- [x] 1.3 Lint passes: `npm run lint` — 3cdb075

#### Manual

- [x] 1.4 No production behavior change visible in dashboard generate flow (refactor-only extraction) — 3cdb075

### Phase 2: OpenRouter Service Contract (Fixture Matrix)

#### Automated

- [x] 2.1 Service tests pass: `npm test -- src/lib/openrouter-generate.test.ts` — 5e7deeb
- [x] 2.2 Full suite passes: `npm test` — 5e7deeb
- [x] 2.3 Lint passes: `npm run lint` — 5e7deeb

#### Manual

- [x] 2.4 Deliberate break: empty cards success path — service test goes red, then revert — 5e7deeb

### Phase 3: Handler Privacy + Playwright API & E2E

#### Automated

- [x] 3.1 Handler tests pass: `npm test -- src/lib/ai-generate-handler.test.ts` — f9e2db1
- [x] 3.2 Full Vitest suite passes: `npm test` — f9e2db1
- [x] 3.3 Playwright specs pass: `npx playwright test e2e/ai-generate-api-contract.spec.ts e2e/ai-generate-error-ui.spec.ts` — 75d7357
- [x] 3.4 Lint passes: `npm run lint` — f9e2db1

#### Manual

- [x] 3.5 Happy-path generate on `/dashboard` still works after handler extraction — 75d7357
- [x] 3.6 E2E deliberate break: `{ ok: true, cards: [] }` mock — UI spec goes red, then revert — 75d7357
- [x] 3.7 Network tab spot check: no raw pasted text in generate response — 75d7357
