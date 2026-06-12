<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: AI Generation Contract + Privacy Tests

- **Plan**: context/changes/ai-generation-contract-privacy/plan.md
- **Scope**: All Phases (1â€“3 of 3)
- **Date**: 2026-06-12
- **Verdict**: APPROVED
- **Findings**: 0 critical Â· 3 warnings Â· 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 â€” False positive privacy assertion in empty-text E2E test

- **Severity**: âš ď¸Ź WARNING
- **Impact**: đź”Ž MEDIUM â€” real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: e2e/ai-generate-api-contract.spec.ts:33
- **Detail**: The "authenticated empty text returns 400" test reads the response body and asserts it does not contain `OVER_MAX_SENTINEL` (an 8021-char string). But the test sends `{ text: "" }` â€” the sentinel cannot appear in that response under any code path. The assertion is trivially unfalsifiable: it looks like a privacy check but cannot catch a regression. If a future refactor echoed the request body, this test would still pass because the empty-text path never receives the sentinel. The real privacy proof lives correctly in the over-max test case.
- **Fix**: Remove the `body`/`OVER_MAX_SENTINEL` assertion from the empty-text test; keep only `expect(response.status()).toBe(400)`.
  - Strength: Removes a misleading assertion without any coverage loss; the real privacy proof remains in the over-max case.
  - Tradeoff: Minimal â€” one line deleted.
  - Confidence: HIGH â€” the empty-text path structurally cannot echo a value it never received.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 â€” Lint fails: CRLF line endings in E2E infrastructure files

- **Severity**: âš ď¸Ź WARNING
- **Impact**: đźŹ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency / Success Criteria
- **Location**: e2e/auth.setup.ts (20 errors), e2e/seed.spec.ts (39 errors), playwright.config.ts (59 errors)
- **Detail**: `npm run lint` exits 1 with 118 prettier/prettier CRLF errors across three untracked files (none are in the committed diff of this plan). These files were written with Windows CRLF line endings; the project expects LF. Because all three are untracked (??), the pre-commit hook never normalized them. The plan's Progress item 3.4 was stamped at f9e2db1 â€” at that point these files may not have existed or lint was not re-run after they were added. Current state: lint fails.
- **Fix**: Run `npm run lint:fix` (or `npx prettier --write` on the three files) to convert CRLF â†’ LF, then commit the files.
  - Strength: Auto-fixable in one command; unblocks CI gate when untracked files are committed.
  - Tradeoff: Requires committing the untracked E2E infrastructure files â€” which should happen regardless.
  - Confidence: HIGH â€” identical CRLF errors resolved identically across the rest of the committed codebase.
  - Blind spot: Haven't confirmed whether these files were intentionally left untracked or are pending commit in another change.
- **Decision**: FIXED

### F3 â€” Hardcoded limit constants in E2E specs (no sync comments)

- **Severity**: âš ď¸Ź WARNING
- **Impact**: đźŹ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/ai-generate-api-contract.spec.ts:8, e2e/ai-generate-error-ui.spec.ts:42
- **Detail**: `MAX_SOURCE_TEXT_CHARS = 8_000` is hardcoded in the API contract spec; `/^0\/50$/` hardcodes `MAX_CARDS_PER_REQUEST = 50` in the UI error spec. Real constants live in `src/lib/ai-generation-limits.ts`. If either limit changes, the E2E tests silently test a stale boundary.
- **Fix**: Add sync comments above each hardcoded value: `// Keep in sync with src/lib/ai-generation-limits.ts`
- **Decision**: FIXED

### F4 â€” Guest API test uses inline context, not the `guest` Playwright project

- **Severity**: OBSERVATION
- **Impact**: đźŹ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/ai-generate-api-contract.spec.ts:12â€“24
- **Detail**: E2E-RULES.md states guest/unauthenticated flows use the `guest` Playwright project. The guest-401 test runs under the `chromium` project and creates an unauthenticated context inline. The result is functionally correct but deviates from the established convention without explanation.
- **Fix**: Add a comment explaining the deviation: the inline approach is intentional for API-layer tests where no page navigation is involved.
- **Decision**: FIXED

### F5 â€” test-plan.md Â§3 Phase 3 row still reads "not started"

- **Severity**: OBSERVATION
- **Impact**: đźŹ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md Â§3 Phased Rollout
- **Detail**: Â§6 AI generation row was correctly updated (status: active, file refs, Risks #3/#4/#5). Â§3 Phase 3 row still shows status "not started" with change folder "â€”". The plan only required updating Â§6, so this is outside scope â€” but it leaves the test-plan document stale now that Phase 3 is implemented.
- **Fix**: Update Â§3 Phase 3 row to `complete` with the change folder reference `ai-generation-contract-privacy`.
- **Decision**: FIXED

### F6 â€” Empty-string cards intentionally pass parseCardsFromLlmPayload: no test documents this

- **Severity**: OBSERVATION
- **Impact**: đźŹ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai-response-parse.ts:6â€“9
- **Detail**: `cardDraftSchema` uses `z.string()` with no `.min(1)`. Empty-string cards pass `parseCardsFromLlmPayload` and are caught downstream by `validateFlashcardDrafts`. No test explicitly asserts this intentional behavior. If `.min(1)` is added defensively, the Risk #4 error key silently changes from `no_valid_drafts` to `generate` with no test catching the regression at the parse layer.
- **Fix**: Add one test to `ai-response-parse.test.ts` asserting `parseCardsFromLlmPayload([{ question: "", answer: "" }])` returns non-null, with a comment noting validation is deferred to `validateFlashcardDrafts`.
- **Decision**: FIXED

### F7 â€” `from` in AiGenerateHandlerSupabase interface lacks explanatory comment

- **Severity**: OBSERVATION
- **Impact**: đźŹ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/ai-generate-handler.ts:13â€“21
- **Detail**: The interface declares `from: (table: string) => unknown` but the handler never calls it. Without a comment, future readers may think it is an oversight or add a call believing it is already scaffolded. The member exists solely so tests can spy and assert it was never invoked (Risk #3).
- **Fix**: Add `/** Present so tests can assert this is never called (Risk #3). */` above the `from` member.
- **Decision**: FIXED
