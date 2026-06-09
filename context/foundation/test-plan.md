---
project: "10xCards"
version: 1
status: active
created: 2026-06-08
context_type: brownfield
test_base: none
hot_spot_scope:
  - src/
  - supabase/
hot_spot_window: "30 days"
---

## §1 Strategy

Three principles govern every rollout phase and downstream plan:

1. **Cost × signal.** Every test added — classic or AI-native — must answer: *what is the cheapest test that gives a real signal for this risk?* Do not promote to e2e because it "feels safer"; do not layer a vision model on top of a deterministic diff that already catches the regression.

2. **User concerns are evidence.** Risks the team has lived through carry the same weight as PRD lines or hot-spot data.

3. **Risks are scenarios, not code locations.** The risk map cites evidence (PRD lines, interview answers, hot-spot directories with churn counts). It never asserts a file, function, or schema name as "where the failure lives." `/10x-research` grounds each risk in code per rollout phase; `/10x-plan` turns response guidance into test sub-phases.

### Hot-spot scope (likelihood evidence)

Scan window: last 30 days. Scopes: `src/`, `supabase/` (34 commits — sufficient signal).

| Directory | Commits (30d) | Role |
|-----------|---------------|------|
| `src/components/` | 25 | UI churn |
| `src/pages/` | 24 | Routes and pages |
| `src/lib/` | 15 | Shared logic |
| `src/pages/api/` | 14 | API surface |
| `src/lib/srs/`, `src/components/srs/` | 5 each | SRS scheduling |
| `supabase/migrations/` | 2 | Schema stable |

Top changed files (30d): `src/pages/dashboard.astro`, `src/middleware.ts`, `src/components/generator/FlashcardGenerator.tsx`, `src/components/srs/ReviewSession.tsx`, auth API routes.

## §2 Risk Map

Impact and likelihood use coarse **High / Medium / Low** scales. Protect High-impact × Medium-or-higher-likelihood first.

| # | Risk (failure scenario) | Impact | Likelihood | Source(s) — evidence, not anchors |
|---|-------------------------|--------|------------|-----------------------------------|
| 1 | SRS grading succeeds in UI but schedule fields are not updated — cards never reappear for review | High | Medium | Interview Q1; hot-spot dirs `src/lib/srs`, `src/components/srs` (5 commits/30d each); archive S-04; PRD FR-011 |
| 2 | User B reads, edits, or deletes User A's flashcard sets or cards via API | High | Medium | PRD Access Control (private sets); archive F-01 RLS intent; hot-spot `src/pages/api/` (14 commits/30d) |
| 3 | Pasted source text is persisted after generation completes (database, logs, or error payloads) | High | Low–Medium | PRD guardrail (source text leaves no trace); archive S-02 privacy notes |
| 4 | AI generation returns empty, malformed, or schema-invalid cards and the UI shows false success | High | Medium | PRD success criteria (≥75% acceptance); north-star S-02; hot-spot `src/components/generator`, `src/pages/api/` |
| 5 | Unauthenticated or expired-session caller reaches protected API routes or pages and receives data | High | Medium | PRD Access Control; hot-spot `src/middleware.ts` (6 commits/30d); archive auth flow |
| 6 | Bilingual UI regresses — wrong locale, missing strings, or EN copy on PL routes after edits | Medium | Medium | Interview Q3 (bilingual-ui); hot-spot `src/lib/i18n`; archive S-09 (~210+ strings, 14 pages) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context needed | Likely cheapest layer | Anti-pattern to avoid |
|------|----------------------------|----------------|----------------|----------------------|--------------|
| 1 | After grade, card's next review date moves per rating; due query returns it when due | "200 OK" on grade API implies schedule updated | Grade endpoint, FSRS mapper, schedule storage fields, due filter | Unit/integration on grade service + due filter | Mock entire FSRS and assert mock was called |
| 2 | Authenticated user B cannot CRUD resources owned by user A | "RLS exists" without API-level proof | Routes accepting set/card IDs, session auth shape | Integration with two user contexts | Only test middleware redirect |
| 3 | No row or log retains raw pasted text post-generation | "No dedicated table" means no leak via logs/errors | Generate route write paths, logging | Integration: generate → inspect persistence | Assert prompt text without checking writes |
| 4 | Valid input → ≥1 valid Q+A pair; bad AI JSON → safe user error | Happy-path 200 means cards usable | OpenRouter route, validation schema, error mappers | Unit/integration with fixture AI responses | Expected values copied from parser code |
| 5 | No session → 401/redirect on protected API and pages; no data body | Middleware file exists → all routes covered | Protected route list, API vs page auth split | Integration on sample protected endpoints | Only signin happy-path test |
| 6 | Guest locale toggle + logged-in frozen locale render correct strings on critical flows | One dashboard string check covers i18n | Locale middleware, cookie/metadata, translation keys | Targeted component or narrow route tests | Full-page HTML snapshots per route |

## §3 Phased Rollout

Status vocabulary (orchestrator literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

| # | Phase | Goal | Risks | Test types | Status | Change folder |
|---|-------|------|-------|------------|--------|---------------|
| 1 | Bootstrap + SRS scheduling | Wire Vitest; prove grade → schedule update → due retrieval so silent SRS failure cannot ship undetected | 1 | Runner setup, unit/integration on SRS core | implementing | testing-bootstrap-srs-scheduling |
| 2 | Auth + ownership boundaries | Protected routes reject unauthenticated callers; cross-user CRUD blocked | 2, 5 | API integration | not started | — |
| 3 | AI generation contract + privacy | Valid/malformed AI responses handled; no source-text persistence | 3, 4 | Unit/integration with fixture responses | not started | — |
| 4 | i18n critical-path smoke | Key flows render correct locale without full snapshot suite | 6 | Component or narrow integration tests | not started | — |
| 5 | CI quality gate | `npm test` blocks merge alongside lint + build | All | CI workflow | not started | — |

## §4 Stack

| Item | Value |
|------|-------|
| Runtime | Astro 6 SSR + React 19 islands on Cloudflare Workers |
| Data / auth | Supabase (cookie SSR sessions, RLS) |
| Validation | Zod 4 at API boundaries |
| SRS library | ts-fsrs |
| Test runner | Vitest (`npm test`, `src/**/*.test.ts`) |
| CI | GitHub Actions: lint + build only (no test job) |
| Test-base profile | `none` — 0 test files, no runner config |

**Stack grounding tools (current session):**

- Docs: Context7 — Astro/Vitest/Supabase setup when planning; checked: 2026-06-08
- Search: web search — tool comparisons and current docs fallback; checked: 2026-06-08
- Runtime/browser: not available in current session — e2e deferred unless added later; checked: 2026-06-08
- Provider/platform: Supabase MCP — RLS/advisor checks during research phases; checked: 2026-06-08

## §5 User-Stated Concerns (Phase 2 interview)

| # | Question | Answer | Implied risk(s) |
|---|----------|--------|-----------------|
| 1 | Worries most | SRS silently stops scheduling — cards never come back | Risk #1 |
| 2 | Burned before | Nothing yet — "so far is ok" | — |
| 3 | Change without confidence | Bilingual UI (S-09) | Risk #6 |
| 4 | Under-tested | Skipped — no meaningful suite | Phase 1 bootstrap |
| 5 | Do NOT spend on | Cloudflare ↔ Supabase connection | §7 negative space |

## §6 Cookbook (patterns by behavior)

Patterns land as rollout phases complete. Placeholders name the failure mode, not the test type.

| Area | Pattern | Status |
|------|---------|--------|
| SRS scheduling | Lib-layer grade + `isFlashcardDue` flow tests — `gradeCard()` → `isFlashcardDue()` proves schedule update and due-queue semantics without HTTP/DB; see `src/lib/srs/is-due.test.ts`, `fsrs-mapper.test.ts`, `grade-card.test.ts`, `grade-due-flow.test.ts` | active |
| Auth + ownership | TBD — see §3 Phase 2: unauthenticated denial + cross-user CRUD block | pending Phase 2 |
| AI generation | TBD — see §3 Phase 3: valid/malformed AI response + no source-text persistence | pending Phase 3 |
| i18n | TBD — see §3 Phase 4: locale toggle and frozen post-login locale on critical flows | pending Phase 4 |
| CI gate | TBD — see §3 Phase 5: test job in GitHub Actions | pending Phase 5 |

## §7 Negative Space

Do **not** spend test budget on:

- **Cloudflare ↔ Supabase platform connectivity** — treat the Workers-to-Supabase link as a platform contract; test application behavior (API routes, RLS enforcement, session handling) instead of infra reachability probes.
- **Full visual regression / pixel-perfect paper theme** — styling polish, not product-risk signal.
- **Generated or boilerplate config** — lockfiles, wrangler defaults, shadcn scaffolding.

Refresh cadence: re-run `/10x-test-plan --refresh` when a new top-3 risk surfaces, a stack grounding `checked:` date is > 3 months old, the tech stack changes, or §7 no longer matches team belief.
