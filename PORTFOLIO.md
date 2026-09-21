# 10xCards — Portfolio Case Study

> Replace the repository and live-demo placeholders below before publishing this document.

- **Project:** 10xCards
- **Type:** Full-stack, AI-assisted learning web application
- **Status:** Functional MVP
- **Repository:** `[add public repository URL]`
- **Live demo:** `[add production URL]`
- **Primary stack:** Astro 7, React 19, TypeScript, Tailwind CSS 4, Supabase, OpenRouter, Cloudflare Workers

## Executive Summary

10xCards is a full-stack learning application that turns pasted study material into editable flashcards and schedules reviews with the Free Spaced Repetition Scheduler (FSRS). It combines AI-assisted content creation, private cloud storage, and evidence-based review scheduling in one workflow.

An authenticated user can:

- paste source material and generate question-and-answer cards with AI;
- review, edit, or remove generated drafts before saving;
- organize cards into private sets;
- create, edit, and delete cards manually;
- study cards that are currently due;
- grade each answer as Again, Hard, Good, or Easy;
- use the interface in English or Polish;
- delete the account and all associated data.

The application is rendered server-side with Astro and deployed as a Cloudflare Worker. Supabase provides authentication and PostgreSQL storage, while Row Level Security protects every user's data at the database level.

## The Problem

Spaced repetition is effective, but preparing high-quality flashcards manually creates a large up-front cost. Learners often spend more time converting notes into questions and answers than reviewing the material itself.

10xCards reduces that friction. A learner pastes notes, receives structured flashcard suggestions, reviews the output, and saves only the cards they approve. The generated cards then enter the same FSRS review flow as manually created cards.

## Product Scope

### Authentication and account management

- Email and password registration and sign-in with Supabase Auth.
- Cookie-based SSR sessions through `@supabase/ssr`.
- Protected application routes for the dashboard, sets, reviews, and settings.
- Session validation on every request with `supabase.auth.getUser()`.
- Account deletion through a server-only Supabase admin client.
- Cascading deletion of the user's sets and cards at the database level.

### Flashcard organization

- Create, rename, browse, and delete named flashcard sets.
- Add cards manually.
- Edit or delete existing cards.
- View per-set and total due-card counts.
- Keep the dashboard synchronized after card and review operations.

### Spaced-repetition reviews

- Start a review session for a selected set.
- Fetch the earliest card whose `due_at` value is in the past.
- Reveal the answer and grade recall as Again, Hard, Good, or Easy.
- Calculate the next review with the real `ts-fsrs` scheduler.
- Persist a versioned FSRS state in JSON and a queryable `due_at` timestamp.
- Show an empty state and the next scheduled review when no cards are due.

### Localization

- English and Polish translations.
- Locale resolution from authenticated user metadata, a locale cookie, the `Accept-Language` header, and finally the English default.
- Typed translation keys shared by Astro pages and React islands.
- Correct `<html lang>` output for the active locale.

## Architecture

```text
Browser
  |
  v
Cloudflare Worker
  Astro SSR pages + API routes
  React interactive islands
  |
  +--> Supabase Auth
  |
  +--> Supabase PostgreSQL
  |      Row Level Security
  |
  +--> OpenRouter API
         Gemini flashcard generation
```

### Frontend

- Astro components render pages, layouts, and static content.
- React islands handle interactive workflows such as generation, set management, review sessions, and account deletion.
- Tailwind CSS and shadcn/ui primitives provide the responsive interface.
- Zod and shared limits keep client and server validation aligned.

### Backend

- Astro API routes execute in the Cloudflare Workers runtime.
- Thin route modules delegate important behavior to testable service and handler functions.
- Supabase SSR clients use request cookies for authenticated, user-scoped database access.
- The Supabase service-role key is isolated to account deletion and never sent to the browser.

### Data model and authorization

The MVP uses two application tables:

- `flashcard_sets` stores named sets and their owning `user_id`.
- `flashcards` stores the question, answer, set relationship, FSRS state, and next due date.

Row Level Security is enabled on both tables:

- users can only create, read, update, or delete their own sets;
- card access is allowed only when the card belongs to a set owned by the current user;
- anonymous database access is not permitted;
- foreign-key cascades remove sets and cards when an account is deleted.

This makes PostgreSQL, rather than UI filtering alone, the ownership boundary.

## AI Integration

### User flow

1. An authenticated user opens the AI generator on the dashboard.
2. The user pastes study material.
3. The React component sends `{ text }` to `POST /api/ai/generate`.
4. The server validates authentication, JSON shape, whitespace, and input length.
5. The OpenRouter service sends the source text and a system prompt to the configured model.
6. The response passes through envelope validation, JSON extraction, structural parsing, and semantic card validation.
7. Valid cards return to the browser as editable drafts.
8. The user edits or removes drafts and selects a target set.
9. A separate bulk-create endpoint saves only the approved question-and-answer pairs.

### Provider and model

- **Provider:** OpenRouter chat completions API
- **Model:** `google/gemini-2.5-flash-lite`
- **Response mode:** JSON object
- **Request timeout:** 15 seconds
- **Authentication:** server-only `OPENROUTER_API_KEY`

The model receives:

- a system instruction that requests concise, self-contained flashcards;
- the pasted source text as the user message;
- an exact JSON response contract:

```json
{
  "cards": [
    {
      "question": "...",
      "answer": "..."
    }
  ]
}
```

### Defense-in-depth validation

LLM output is treated as untrusted input and passes through several layers:

1. Zod validates the OpenRouter response envelope.
2. The parser accepts plain JSON and strips markdown code fences when necessary.
3. The payload parser accepts the expected wrapped object and a tolerated bare-array form.
4. Structural validation limits the result to 1–50 cards.
5. Semantic validation trims fields, removes empty pairs, and rejects oversized content.
6. The UI allows the learner to review and edit every draft before persistence.
7. The bulk-save API validates the cards again before inserting them.

### Enforced limits

- Maximum pasted source length: **8,000 characters**
- Maximum question or answer length: **2,000 characters**
- Maximum generated or bulk-saved cards: **50**
- OpenRouter timeout: **15,000 ms**

The same constants are shared across the UI, API handler, parser, validator, and persistence endpoint where applicable.

### Privacy and failure handling

- Source text is processed in memory and is not stored in the application database.
- The generation handler performs no database write.
- Only user-approved question-and-answer pairs are persisted.
- Error responses do not echo the pasted source text.
- Missing API configuration fails closed without attempting a network call.
- Provider errors, malformed responses, invalid JSON, validation failures, and timeouts map to stable localized error keys.
- Raw upstream diagnostics are only logged during development.

The source text is necessarily sent to OpenRouter to perform generation. This should be disclosed in any public privacy policy.

### Current AI trade-offs

The current MVP intentionally does not include:

- streaming generation;
- a live-provider happy-path test in CI;
- per-user generation rate limiting;
- environment-based model selection;
- custom temperature or token settings;
- persistence of the original source text.

These are explicit extension points rather than features that should be implied as complete.

## Automated Testing Strategy

The project uses a risk-driven testing approach with two main layers:

- **Vitest** for fast, deterministic unit and service tests.
- **Playwright** for browser, API-contract, authentication, and persistence scenarios.

The current repository was verified with:

```text
Test Files: 8 passed
Tests:      52 passed
```

Command:

```bash
npm test
```

### Vitest configuration

- Version: Vitest 4.
- Runtime: Node.
- Test pattern: `src/**/*.test.ts`.
- Path alias: `@/` maps to `src/`.
- No application server, browser, live database, or live OpenRouter request is required.
- A standalone Vitest configuration avoids loading the Astro Cloudflare adapter into the test runtime.

### SRS unit and service tests

The SRS suite uses the real `ts-fsrs` library rather than mocking the scheduling algorithm.

`src/lib/srs/is-due.test.ts` verifies:

- stable UTC timestamp generation;
- due-card behavior before, at, and after the comparison time;
- timestamps that include explicit timezone offsets.

`src/lib/srs/fsrs-mapper.test.ts` verifies:

- conversion of a new card into FSRS defaults;
- round-tripping a persisted schedule;
- strict rejection of malformed dates and numeric state;
- versioned `srs_state` persistence.

`src/lib/srs/grade-card.test.ts` verifies:

- use of the real scheduler;
- all four ratings: Again, Hard, Good, and Easy;
- future scheduling after a successful review;
- the scheduling difference between failed and successful recall.

`src/lib/srs/grade-due-flow.test.ts` verifies:

- an end-to-end library flow from due card to graded card;
- removal of a graded card from the current due queue;
- retention of ungraded due cards;
- preservation of versioned state through a grade cycle.

### AI unit and service tests

`src/lib/ai-response-parse.test.ts` verifies:

- plain JSON parsing;
- markdown-fenced JSON parsing;
- invalid JSON rejection;
- wrapped and bare-array response shapes;
- rejection of incorrect or empty payloads;
- separation between structural parsing and semantic validation.

`src/lib/flashcard-draft-validation.test.ts` verifies:

- trimming valid input;
- rejection of empty fields;
- filtering mixed valid and empty cards;
- fail-fast behavior for oversized questions or answers;
- batch validation behavior.

`src/lib/openrouter-generate.test.ts` verifies:

- valid wrapped, bare-array, and markdown-fenced model output;
- malformed JSON;
- unexpected response shapes;
- empty card output;
- oversized card fields;
- OpenRouter HTTP failures;
- malformed chat-completion envelopes;
- request timeout behavior with fake timers;
- missing API keys;
- prevention of network calls when configuration is absent.

OpenRouter HTTP calls are stubbed in these tests. Reusable fixtures construct valid and invalid chat-completion envelopes without consuming provider credits or depending on an external service.

`src/lib/ai-generate-handler.test.ts` verifies:

- authentication is required;
- unauthenticated requests do not invoke the generator;
- successful responses never echo a unique source-text sentinel;
- failed responses never echo a unique source-text sentinel;
- the generation path never performs a Supabase table write.

The handler accepts injected dependencies, which makes privacy and authorization behavior testable without a live Astro server.

### Playwright E2E and contract tests

The Playwright configuration:

- starts `npm run dev` automatically;
- uses `http://localhost:4321` by default;
- supports `PLAYWRIGHT_BASE_URL` overrides;
- loads optional environment values from `.env`;
- saves authenticated browser state once and reuses it;
- separates guest and authenticated projects;
- retries twice and uses one worker in CI mode;
- records a trace on the first retry;
- outputs an HTML report.

The setup project signs in through the real UI with:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `E2E_USER_B_EMAIL`
- `E2E_USER_B_PASSWORD`

It stores independent authenticated sessions for the owner and attacker accounts.

Nine Playwright scenarios are currently defined:

1. A guest visiting `/dashboard` is redirected to sign-in without protected dashboard content being exposed.
2. A guest posting to `/api/ai/generate` receives HTTP 401.
3. An authenticated request with empty source text receives HTTP 400.
4. An authenticated request with whitespace-only source text receives HTTP 400.
5. An authenticated oversized request receives HTTP 400 without echoing the privacy sentinel.
6. A mocked AI provider failure produces an error banner, no draft rows, and an idle generate button.
7. A newly created flashcard set remains available after a full page reload and is cleaned up after the test.
8. The public health endpoint reports readiness without exposing configuration values.
9. A second authenticated user cannot read, create, update, or delete the first user's sets and cards through application APIs.

The E2E suite deliberately mixes real and mocked dependencies:

- route protection and SSR middleware are real;
- Supabase authentication is real;
- the persistence smoke test uses the real configured Supabase database;
- the AI error UI test intercepts the generate endpoint and returns a controlled 502 response;
- validation and authorization contract tests avoid a live OpenRouter request.

E2E conventions include:

- accessibility-first locators such as roles and labels;
- no CSS or XPath selectors;
- no fixed `waitForTimeout` calls;
- timestamped test data;
- explicit cleanup;
- reusable authenticated storage state;
- bilingual English/Polish locator patterns.

Run the browser suite with:

```bash
npm run test:e2e
```

or use the interactive runner:

```bash
npm run test:e2e:ui
```

Authenticated E2E tests require a configured Supabase instance and dedicated test-account credentials.

### What runs automatically in CI

GitHub Actions runs on pushes and pull requests targeting `master`.

The required CI job executes:

```text
npm ci
npx astro sync
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run build
```

This means the automated merge gate includes:

- dependency installation from the lockfile;
- Astro type generation;
- a production dependency vulnerability gate;
- ESLint;
- all 52 Vitest tests;
- a production SSR build.

A separate security-integration job starts an ephemeral local Supabase stack, runs transactional pgTAP tests against the RLS policies, creates two local-only test users, and runs the complete Playwright suite. It does not require production credentials and is safe to execute for pull requests from forks.

### Deployment verification

Deployment is intentionally manual from a trusted Cursor terminal:

1. run the complete CI-equivalent checks;
2. create a production build;
3. deploy through Wrangler;
4. smoke-check `/`, `/auth/signin`, and `/api/health`.

GitHub Actions does not hold Cloudflare deployment credentials.

### Local quality gates

Husky and lint-staged run before commits:

- ESLint with automatic fixes for TypeScript, TSX, and Astro files;
- Prettier for JSON, CSS, and Markdown files.

Tests are not run by the pre-commit hook.

### Honest test coverage boundaries

The current suite does not claim:

- code-coverage percentage reporting;
- live OpenRouter generation in automated tests;
- complete bilingual critical-path E2E coverage.

These are appropriate next steps for a larger production rollout.

## CI/CD and Deployment

The application targets Cloudflare Workers through the official Astro adapter.

Production characteristics include:

- full server-side rendering;
- static asset delivery from the Worker build;
- `nodejs_compat` for required Node APIs;
- Cloudflare observability enabled;
- secrets stored as Worker secrets rather than bundled client variables;
- manual deployment through the authenticated Wrangler CLI;
- manual post-deployment smoke checks.

Runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`

Build-time GitHub configuration:

- `SUPABASE_URL`
- `SUPABASE_KEY`

## Selected Engineering Decisions

### Astro SSR with React islands

Astro handles server rendering and page composition, while React is used only for stateful interactions. This keeps the client-side JavaScript surface focused on features that require it.

### Database-enforced ownership

Supabase Row Level Security protects sets and cards even if an API route makes an incorrect query. User ownership is enforced near the data rather than being dependent on UI behavior.

### FSRS instead of a custom scheduler

The application uses a maintained scheduling library and tests the real algorithm. A versioned JSON state allows the persistence format to evolve, while `due_at` remains efficient to query and index.

### Stateless AI generation

Generation and persistence are separate operations. The server does not automatically save model output, and the learner remains in control of what enters the database.

### Layered LLM validation

The code does not trust provider formatting. Network-envelope validation, JSON extraction, payload parsing, semantic validation, user review, and persistence validation form multiple independent safeguards.

### Dependency injection at the handler boundary

The extracted generation handler accepts a generator dependency and a minimal Supabase interface. This makes authorization, privacy, and failure behavior deterministic and inexpensive to test.

### Risk-driven tests

Tests focus first on scheduling correctness, authorization, privacy, malformed AI output, timeout behavior, and persistent user data rather than only checking rendered components.

## Engineering Challenges and Solutions

### Unpredictable model output

**Challenge:** Even when JSON mode is requested, LLM responses can be fenced, malformed, empty, or structurally incorrect.

**Solution:** Build a staged parser and validator, accept a narrow set of known variants, reject everything else, and require user review before saving.

### Testing AI without flaky or billable CI calls

**Challenge:** Live model calls are slow, nondeterministic, dependent on credentials, and can create recurring test costs.

**Solution:** Stub `fetch`, use realistic OpenRouter response fixtures, test malformed and timeout paths deterministically, and reserve browser tests for local API/UI contracts.

### Protecting pasted study material

**Challenge:** Source content may be sensitive and should not accidentally appear in logs, API errors, or database rows.

**Solution:** Keep generation stateless, persist only approved cards, return stable error keys, and use unique privacy sentinels in automated tests.

### Persisting an algorithm-specific review state

**Challenge:** FSRS requires multiple internal values while due-card queries need a simple indexed timestamp.

**Solution:** Store versioned scheduler state in JSONB and duplicate the next due date into an indexed `due_at` column.

### Testing Astro logic with the Cloudflare adapter

**Challenge:** Loading Astro's full Vite configuration pulled the Cloudflare adapter into Vitest and caused module-resolution incompatibilities.

**Solution:** Use a focused standalone Vitest configuration for pure Node unit and service tests.

## Current Limitations and Next Steps

The most valuable production-hardening steps are:

1. add per-user or per-account AI generation rate limits;
2. add complete English and Polish critical-path smoke tests;
3. configure coverage reporting and meaningful thresholds;
4. make the OpenRouter model configurable through a server-only environment variable;
5. add provider usage and latency observability without logging source text;
6. document provider data handling in a public privacy policy.

## Key Technologies Demonstrated

- Astro 7 SSR
- React 19 islands
- TypeScript
- Tailwind CSS 4
- shadcn/ui and Radix UI
- Supabase Auth
- Supabase PostgreSQL
- Row Level Security
- Zod validation
- OpenRouter chat completions
- Gemini model integration
- FSRS spaced repetition with `ts-fsrs`
- Vitest
- Playwright
- GitHub Actions
- Cloudflare Workers
- Wrangler
- ESLint, Prettier, Husky, and lint-staged

## Repository Map

```text
src/
├── components/
│   ├── account/       Account deletion UI
│   ├── auth/          Sign-in and sign-up components
│   ├── dashboard/     Set grid and due-card summary
│   ├── flashcards/    Card creation and management
│   ├── generator/     AI generation workflow
│   ├── i18n/          React locale provider
│   ├── layout/        Application shell and top bar
│   ├── srs/           Interactive review session
│   └── ui/            Shared UI primitives
├── lib/
│   ├── i18n/          English and Polish dictionaries
│   ├── srs/           FSRS mapping, grading, and due logic
│   ├── test-fixtures/ OpenRouter test fixtures
│   ├── ai-generate-handler.ts
│   ├── ai-response-parse.ts
│   ├── openrouter-generate.ts
│   └── supabase.ts
├── pages/
│   ├── api/           Auth, AI, set, card, SRS, and locale APIs
│   ├── auth/          Authentication pages
│   ├── sets/          Set management and review pages
│   ├── dashboard.astro
│   └── settings.astro
└── middleware.ts

e2e/                   Playwright setup and scenarios
supabase/migrations/   PostgreSQL schema and RLS policies
supabase/tests/        Transactional pgTAP security tests
.github/workflows/     CI quality and security gates
```

## Short Portfolio Description

10xCards is an AI-assisted flashcard application built with Astro, React, TypeScript, Supabase, and Cloudflare Workers. It converts pasted study material into editable question-and-answer cards through OpenRouter, then schedules reviews with FSRS. The project includes database-level Row Level Security, bilingual UI, server-only secret handling, 52 Vitest tests, nine Playwright scenarios, automated CI builds, and post-deployment smoke checks.

## Resume-Ready Bullet Points

- Built a full-stack AI flashcard platform with Astro 7 SSR, React 19, TypeScript, Supabase, and Cloudflare Workers.
- Integrated OpenRouter and Gemini to transform pasted educational content into editable flashcard drafts with layered Zod validation and privacy-conscious error handling.
- Implemented FSRS-based spaced repetition with versioned scheduler state, indexed due dates, and tests against the real scheduling library.
- Secured user data with Supabase cookie authentication and PostgreSQL Row Level Security policies for set and card ownership.
- Created a risk-driven quality strategy with 52 passing Vitest tests, transactional pgTAP RLS tests, and nine Playwright browser/API scenarios covering AI contracts, privacy, authentication, cross-user isolation, persistence, health, and error states.
- Automated linting, security audits, unit tests, integration tests, and production builds with GitHub Actions; deployed manually to Cloudflare with Wrangler.

## Interview Talking Points

- Why AI generation and database persistence are separate steps.
- How layered validation protects the application from malformed LLM output.
- Why model calls are mocked in deterministic tests.
- How privacy sentinels prove that source text is not echoed in API responses.
- Why RLS is a stronger ownership boundary than route-level filtering alone.
- How FSRS state is mapped into a durable, versioned database representation.
- Why Playwright uses separate guest, setup, and authenticated projects.
- How ephemeral Supabase and Playwright jobs verify integration behavior without production secrets.
