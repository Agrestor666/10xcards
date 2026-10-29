# Topic Flashcard Generation Implementation Plan

## Overview

Enable signed-in learners to generate flashcards by entering a short topic (up to 200 characters, in Polish or English) in addition to pasting raw study notes. The server retrieves current information via OpenRouter's Web Search plugin (`plugins: [{ id: "web" }]`) using the existing `OPENROUTER_API_KEY`, produces ~8–12 concise `{ question, answer }` pairs in the language of the topic, and routes them through the existing FR-005 review gate (`FlashcardGenerator`) where the user can edit or remove individual drafts and save the accepted cards to an existing set or a newly created inline set without reloading `/dashboard`.

## Current State Analysis

- **AI Generation Pipeline (`src/lib/openrouter-generate.ts`, `src/lib/ai-generate-handler.ts`, `src/pages/api/ai/generate.ts`)**:
  - `src/pages/api/ai/generate.ts:10-28` parses JSON and delegates to `handleAiGenerateRequest` (`src/lib/ai-generate-handler.ts:36-81`).
  - `handleAiGenerateRequest` currently validates only `{ text: z.string() }` (`src/lib/ai-generate-handler.ts:9-11`), enforcing non-empty trimmed input and `text.length <= MAX_SOURCE_TEXT_CHARS` (`20_000` in `src/lib/ai-generation-limits.ts:2`), then calls `generateFlashcardsFromText(text)`.
  - `generateFlashcardsFromText` (`src/lib/openrouter-generate.ts:32-108`) posts to `${OPENROUTER_DEFAULT_BASE_URL}/chat/completions` with `model: OPENROUTER_DEFAULT_MODEL` (`"google/gemini-2.5-flash-lite"`), `response_format: { type: "json_object" }`, and `AbortController` (`OPENROUTER_REQUEST_TIMEOUT_MS = 30_000`), then extracts and validates `{ question, answer }` drafts via `extractJsonPayload`, `parseCardsFromLlmPayload`, and `validateFlashcardDrafts`.
- **Generator UI & Set Creation (`src/components/generator/FlashcardGenerator.tsx`, `src/pages/api/flashcard-sets/create.ts`, `src/lib/dashboard-set-sync.ts`)**:
  - `FlashcardGenerator.tsx:45-348` renders a single `<textarea>` for pasted text, a `Generate` button, a `<select>` of existing sets (`sets` passed from `src/pages/dashboard.astro:34,70`), and the draft review card list (`FlashcardRow` in `mode="draft"`).
  - Creating a set via `NewSetDialog.tsx:64-66` calls `window.location.assign("/dashboard")` on success, which reloads the page and wipes any unsaved `cardsDraft` in `FlashcardGenerator`.
  - `POST /api/flashcard-sets/create` (`src/pages/api/flashcard-sets/create.ts:25-82`) currently reads `context.request.formData()`, inserts `{ user_id, name }` without `.select()`, and returns `{ ok: true }` (HTTP 201) when `Accept: application/json` is set.
  - `src/lib/dashboard-set-sync.ts` defines custom window events (`DASHBOARD_SET_CARDS_ADDED`, `DASHBOARD_SET_DELETED`, `DASHBOARD_SET_REVIEW_GRADED`) consumed by `SetDashboardGrid.tsx:128-175` and `StudyHero.tsx:22-59`, but does not yet broadcast newly created sets (`DASHBOARD_SET_CREATED`) or sync set additions/deletions into `FlashcardGenerator`.
- **Automated Tests (`src/lib/*.test.ts`, `e2e/ai-generate-*.spec.ts`)**:
  - `src/lib/openrouter-generate.test.ts` and `src/lib/ai-generate-handler.test.ts` cover Risk #4 (malformed LLM output never yields false success) and Risk #3 (no source input echoed in response JSON; `supabase.from` never called during generate).
  - `e2e/ai-generate-api-contract.spec.ts` and `e2e/ai-generate-error-ui.spec.ts` verify API 401/400/privacy contracts and UI error banner rendering on `/dashboard`.

## Desired End State

- `FlashcardGenerator` on `/dashboard` offers a Paper-styled segmented mode toggle: **From text** (`"text"`, default) and **From topic** (`"topic"`).
- Switching between **From text** and **From topic** swaps the input control above while preserving any existing `cardsDraft` below; clicking **Generate** in either mode replaces `cardsDraft` with the newly generated batch upon success.
- In **From topic** mode, the user enters a topic up to `MAX_TOPIC_CHARS = 200` characters. Submitting calls `POST /api/ai/generate` with `{ topic }`, which runs `generateFlashcardsFromTopic(topic)` using OpenRouter's `plugins: [{ id: "web", max_results: 5, search_prompt: ... }]` and returns ~8–12 `{ question, answer }` drafts in the language of the topic without source metadata or markdown links.
- In the **Save to set** area of `FlashcardGenerator`, the user can either pick an existing set OR choose **+ Create new set…** (`"__new__"`), enter a new set name (1–80 chars, pre-filled with the trimmed topic when in Topic mode and the user hasn't typed a custom name yet), and click **Save** to atomically create the set (if new), bulk-insert the reviewed drafts, and update `SetDashboardGrid` and `StudyHero` live via window custom events without reloading `/dashboard`.

### Key Discoveries:

- **OpenRouter Web Search default `search_prompt` gotcha**: By default, OpenRouter's `{ id: "web" }` plugin injects a prompt instructing the model: *"IMPORTANT: Cite them using markdown links named using the domain of the source. Example: [nytimes.com](https://nytimes.com/some-page)."* Because S-13 stores pure `{ question, answer }` cards without source URLs, we must override `search_prompt` in `plugins: [{ id: "web", max_results: 5, search_prompt: ... }]` so the model uses the retrieved web facts without polluting answers with markdown links or breaking JSON output.
- **Set creation reload hazard (`src/components/dashboard/NewSetDialog.tsx:65`)**: `NewSetDialog` triggers `window.location.assign("/dashboard")`, which destroys in-memory drafts in `FlashcardGenerator`. Extending `POST /api/flashcard-sets/create` to return the created `set` row (`{ id, name, created_at, updated_at }`) and dispatching `DASHBOARD_SET_CREATED` lets `FlashcardGenerator` create a new target set and immediately save drafts into it without a full page reload.
- **Backward-compatible `/api/ai/generate` contract (`src/lib/ai-generate-handler.ts:9-11`)**: Accepting either `{ text: string }` or `{ topic: string }` (with optional `mode: "text" | "topic"`) keeps `e2e/ai-generate-api-contract.spec.ts` and `src/lib/ai-generate-handler.test.ts` 100% compatible while extending the same auth, 503, and Risk #3 privacy guarantees to topic prompts.

## What We're NOT Doing

- **No source URL/title storage or display on flashcards**: Cards remain `{ question, answer }` in drafts and in `public.flashcards`; no Supabase schema migration is needed.
- **No external search API keys (Tavily, Brave, Serper)**: Information retrieval uses OpenRouter's built-in `plugins: [{ id: "web" }]` over the existing `OPENROUTER_API_KEY`.
- **No replacement of paste-text generation**: S-02 ("From text") remains the default tab and keeps its `MAX_SOURCE_TEXT_CHARS = 20_000` limit.
- **No auto-save bypassing review**: Topic-generated cards never write to `public.flashcards` during `/api/ai/generate`; the user must review and click **Save** (FR-005).
- **No user-selectable card count dropdown**: Topic mode automatically targets ~8–12 cards (bounded by `MAX_CARDS_PER_REQUEST = 50`).
- **No Cloudflare Turnstile on `/api/ai/generate`**: Protected by authenticated Supabase session (`context.locals.supabase.auth.getUser()`), per Roadmap S-12/S-13 non-goals.

## Implementation Approach

We structure the work into three incremental phases:
1. **Phase 1 (Backend Topic Generation, Set Creation API & Unit Tests)**: Add `MAX_TOPIC_CHARS = 200` and `OPENROUTER_WEB_SEARCH_MAX_RESULTS = 5` to `src/lib/ai-generation-limits.ts`. Implement `generateFlashcardsFromTopic(topic)` in `src/lib/openrouter-generate.ts` sharing the response parsing/validation pipeline with `generateFlashcardsFromText`. Extend `handleAiGenerateRequest` (`src/lib/ai-generate-handler.ts`) and `POST /api/ai/generate` (`src/pages/api/ai/generate.ts`) to support `{ topic }` requests alongside `{ text }`. Update `POST /api/flashcard-sets/create` (`src/pages/api/flashcard-sets/create.ts`) to accept JSON `{ name }` as well as `FormData` and return `{ ok: true, set }` on JSON requests. Add localized server error strings (`en.ts`, `pl.ts`) and comprehensive Vitest unit tests.
2. **Phase 2 (Dashboard Sync & Generator UI — Mode Toggle + Inline New Set)**: Add `DASHBOARD_SET_CREATED` and `DASHBOARD_SET_UPDATED` helpers in `src/lib/dashboard-set-sync.ts`, wire `SetDashboardGrid` and `StudyHero` to react when a first/new set is created without reload, and update `FlashcardGenerator.tsx` with the **From text** / **From topic** mode switcher, topic input (`maxLength={MAX_TOPIC_CHARS}`), and inline **+ Create new set…** option in the target set selector.
3. **Phase 3 (Playwright API Contract & E2E UI Tests)**: Extend `e2e/ai-generate-api-contract.spec.ts` to cover `{ topic }` validation and over-max privacy (Risk #3/#5), and add a Playwright E2E test verifying topic mode generation (with route mock) and saving drafts to a newly created inline set on `/dashboard`.

## Critical Implementation Details

- **OpenRouter Web Search `search_prompt` override (`src/lib/openrouter-generate.ts`)**: OpenRouter's `plugins: [{ id: "web" }]` defaults to a `search_prompt` that commands the LLM to append `[domain.com](https://...)` markdown links to its output. Pass an explicit `search_prompt` in the plugin object instructing the model to incorporate the web search findings into factual Q&A pairs in the same language as the user's topic, without markdown links or citations, and output strictly the `{"cards":[{"question":"...","answer":"..."}]}` JSON object.
- **State sequencing when saving to an inline new set (`src/components/generator/FlashcardGenerator.tsx`)**: When the user selects **+ Create new set…** (`selectedSetId === "__new__"`), clicking **Save** first `POST`s `{ name: newSetName.trim() }` to `/api/flashcard-sets/create` (with `Accept: application/json` and `Content-Type: application/json`). Once `{ ok: true, set }` returns, immediately: (1) append `set` to `FlashcardGenerator`'s local sets list, (2) switch `selectedSetId` to `set.id`, and (3) dispatch `dispatchDashboardSetCreated({ set: { ...set, card_count: 0, due_count: 0 } })` **before** calling `/api/flashcards/bulk-create`. This guarantees that if `bulk-create` subsequently fails, the newly created set is already selected and visible in the dropdown and dashboard grid so a retry does not attempt to create a duplicate set with the same name.

---

## Phase 1: Backend Topic Generation, Set Creation API & Unit Tests

### Overview

Add topic limits and i18n keys, implement `generateFlashcardsFromTopic` with OpenRouter's Web Search plugin, extend `handleAiGenerateRequest` and `POST /api/ai/generate` to handle `{ topic }` alongside `{ text }`, enhance `POST /api/flashcard-sets/create` to return the created set for JSON callers, and verify everything with Vitest unit tests.

### Changes Required:

#### 1. Generation Limits & Constants

**File**: `src/lib/ai-generation-limits.ts`

**Intent**: Define the maximum topic length and OpenRouter web search result cap alongside existing AI generation constants.

**Contract**:
- Export `MAX_TOPIC_CHARS = 200` (`/** Max topic prompt length for topic-based generation (client + server). */`).
- Export `OPENROUTER_WEB_SEARCH_MAX_RESULTS = 5`.

#### 2. Localization Keys for Topic Generation & Inline Set Creation

**File**: `src/lib/i18n/en.ts` and `src/lib/i18n/pl.ts`

**Intent**: Add English and Polish translations for the generator mode switcher, topic input/validation errors, and inline new-set creation inside `FlashcardGenerator`.

**Contract**: Add the following keys to both `en` and `pl`:
- `"generator.mode.text"`: EN `"From text"` / PL `"Z tekstu"`
- `"generator.mode.topic"`: EN `"From topic"` / PL `"Z tematu"`
- `"generator.topic.label"`: EN `"Topic"` / PL `"Temat"`
- `"generator.topic.placeholder"`: EN `"e.g. Photosynthesis in plants, HTTP status codes…"` / PL `"np. Fotosynteza u roślin, kody statusu HTTP…"`
- `"generator.topic.hint"`: EN `"AI searches for information on this topic and proposes flashcards in the same language."` / PL `"AI wyszuka informacje na ten temat i zaproponuje fiszki w tym samym języku."`
- `"generator.error.enter_topic"`: EN `"Enter a topic to generate flashcards."` / PL `"Podaj temat, aby wygenerować fiszki."`
- `"generator.error.topic_max"`: EN `"Topic must be at most {max} characters."` / PL `"Temat może mieć co najwyżej {max} znaków."`
- `"generator.new_set_option"`: EN `"+ Create new set…"` / PL `"+ Utwórz nowy zestaw…"`
- `"generator.new_set_name.label"`: EN `"New set name"` / PL `"Nazwa nowego zestawu"`
- `"generator.new_set_name.placeholder"`: EN `"e.g. Biology"` / PL `"np. Biologia"`

#### 3. OpenRouter Topic Generation Service

**File**: `src/lib/openrouter-generate.ts`

**Intent**: Implement `generateFlashcardsFromTopic(topic: string): Promise<GenerateFlashcardsResult>` using OpenRouter's `chat/completions` endpoint with `plugins: [{ id: "web", max_results: OPENROUTER_WEB_SEARCH_MAX_RESULTS, search_prompt: TOPIC_WEB_SEARCH_PROMPT }]`, sharing the upstream fetch/timeout/JSON-extraction/draft-validation pipeline with `generateFlashcardsFromText`.

**Contract**:
```ts
const TOPIC_SYSTEM_PROMPT = `You are a flashcard generator. Given a study topic and web search results, produce 8 to 12 concise, factually accurate question-and-answer pairs that cover the most important concepts, definitions, and facts about the topic.

Write the questions and answers in the same language as the user's topic. Do NOT include markdown links, URLs, or source citations in the questions or answers.

Respond with ONLY valid JSON in this exact shape (no markdown, no commentary):
{"cards":[{"question":"...","answer":"..."}]}`;

const TOPIC_WEB_SEARCH_PROMPT =
  "Use the following web search results to produce accurate, factual flashcards for the requested topic. Do NOT include markdown links or URLs in the question or answer fields; respond ONLY with the requested JSON object:";

export async function generateFlashcardsFromTopic(topic: string): Promise<GenerateFlashcardsResult>;
```
- Uses a shared internal helper `requestOpenRouterCards(requestBody: Record<string, unknown>): Promise<GenerateFlashcardsResult>` called by both `generateFlashcardsFromText` and `generateFlashcardsFromTopic` so timeout (`OPENROUTER_REQUEST_TIMEOUT_MS`), HTTP status handling, `openRouterChatResponseSchema`, `extractJsonPayload`, `parseCardsFromLlmPayload`, and `validateFlashcardDrafts` have zero duplication.
- For `generateFlashcardsFromTopic(topic)`, `requestBody` includes:
  - `model: OPENROUTER_DEFAULT_MODEL`
  - `response_format: { type: "json_object" }`
  - `plugins: [{ id: "web", max_results: OPENROUTER_WEB_SEARCH_MAX_RESULTS, search_prompt: TOPIC_WEB_SEARCH_PROMPT }]`
  - `messages: [{ role: "system", content: TOPIC_SYSTEM_PROMPT }, { role: "user", content: topic }]`

#### 4. AI Generate Request Handler & API Route

**File**: `src/lib/ai-generate-handler.ts` and `src/pages/api/ai/generate.ts`

**Intent**: Accept either text-mode or topic-mode payloads in `handleAiGenerateRequest` and `POST /api/ai/generate`, enforcing `MAX_SOURCE_TEXT_CHARS` (`20_000`) for text and `MAX_TOPIC_CHARS` (`200`) for topic while preserving all existing `{ text }` behavior and tests.

**Contract**:
- In `src/lib/ai-generate-handler.ts`:
  - `HandleAiGenerateRequestInput` accepts `generateFlashcardsFromText: (text: string) => Promise<GenerateFlashcardsResult>` and optional `generateFlashcardsFromTopic?: (topic: string) => Promise<GenerateFlashcardsResult>`.
  - Request body validation:
    - If `body` is an object with `mode === "topic"` or (`!("text" in body)` and `"topic" in body` where `typeof body.topic === "string"`): validate `topic` as string, trim it; if empty, return `400` with `t(locale, "generator.error.enter_topic")`; if `topic.length > MAX_TOPIC_CHARS`, return `400` with `t(locale, "generator.error.topic_max", { max: MAX_TOPIC_CHARS })` (never echoing `topic`); call `generateFlashcardsFromTopic(topic)`.
    - Otherwise (when `mode === "text"` or `"text" in body` with `typeof body.text === "string"`): run the existing `text` validation (`generator.error.paste_text`, `generator.error.text_max`) and call `generateFlashcardsFromText(text)`.
    - Any other shape (e.g. missing both `text` and `topic`, non-string values, or both `text` and `topic` passed without a disambiguating `mode`) returns `400` with `t(locale, "api.error.invalid_body")`.
- In `src/pages/api/ai/generate.ts`: pass both `generateFlashcardsFromText` and `generateFlashcardsFromTopic` to `handleAiGenerateRequest`.

#### 5. Flashcard Set Creation API (`POST /api/flashcard-sets/create`)

**File**: `src/pages/api/flashcard-sets/create.ts`

**Intent**: Allow `POST /api/flashcard-sets/create` to accept either `FormData` (used by `NewSetDialog`) or `application/json` `{ name: string }` (used by `FlashcardGenerator` inline set creation) and return `{ ok: true, set: { id, name, created_at, updated_at } }` on JSON responses (`status: 201`).

**Contract**:
- Extract `rawName` from JSON body (`{ name }`) when `context.request.headers.get("Content-Type")?.includes("application/json")`, otherwise from `await context.request.formData().then((f) => f.get("name"))`.
- Chain `.select("id, name, created_at, updated_at").single()` onto `supabase.from("flashcard_sets").insert({ user_id: user.id, name: validation.name })`.
- When `asJson` is true, return `jsonResponse({ ok: true, set: data }, 201)` (backward-compatible with `NewSetDialog` which only checks `body.ok`).

#### 6. Unit Tests for Topic Generation & Handler

**File**: `src/lib/openrouter-generate.test.ts` and `src/lib/ai-generate-handler.test.ts`

**Intent**: Extend Vitest unit tests to verify `generateFlashcardsFromTopic` (including the OpenRouter `plugins: [{ id: "web" }]` payload and Risk #4 malformed output handling) and `handleAiGenerateRequest` in topic mode (empty topic 400, over-max topic 400 without echo, Risk #3 sentinel topic never echoed and `supabase.from` never called).

**Contract**:
- In `src/lib/openrouter-generate.test.ts`, add `describe("generateFlashcardsFromTopic (S-13, Risk #4)")` testing:
  - Sends `plugins: [{ id: "web", max_results: 5, search_prompt: expect.any(String) }]` and `response_format: { type: "json_object" }` in the `fetch` request body, and returns `{ ok: true, cards }` on valid JSON response.
  - Returns safe `errorKey` on invalid JSON, empty cards (`generator.error.no_valid_drafts`), HTTP 500, timeout (`generator.error.timeout`), and missing `OPENROUTER_API_KEY`.
- In `src/lib/ai-generate-handler.test.ts`, add topic-mode cases verifying:
  - `{ topic: SENTINEL }` calls `generateFlashcardsFromTopic(SENTINEL)`, returns 200 `{ ok: true, cards }`, never echoes `SENTINEL`, and never calls `supabase.from`.
  - Empty/whitespace `{ topic: "   " }` returns 400 (`generator.error.enter_topic`).
  - Over-max `{ topic: "x".repeat(MAX_TOPIC_CHARS + 1) }` returns 400 (`generator.error.topic_max`) without echoing the input.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Linting passes: `npm run lint`

#### Manual Verification:

- Code review confirms `POST /api/ai/generate` accepts both `{ text }` and `{ topic }` and `POST /api/flashcard-sets/create` returns `{ ok: true, set }` for JSON requests.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual review was successful before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Dashboard Sync & Generator UI (Topic Tab + Inline New Set)

### Overview

Wire cross-island dashboard sync for newly created/renamed/deleted sets, add the **From text** / **From topic** mode toggle inside `FlashcardGenerator`, and add the **+ Create new set…** inline flow in `FlashcardGenerator` so users can generate cards from a topic and save them to a new or existing set without page reload.

### Changes Required:

#### 1. Cross-Island Dashboard Set Sync

**File**: `src/lib/dashboard-set-sync.ts`, `src/components/dashboard/SetDashboardGrid.tsx`, `src/components/dashboard/StudyHero.tsx`

**Intent**: Keep `SetDashboardGrid`, `StudyHero`, and `FlashcardGenerator` synchronized when a set is created inline (or renamed/deleted in the grid) without requiring a full page reload.

**Contract**:
- In `src/lib/dashboard-set-sync.ts`:
  - Export `DASHBOARD_SET_CREATED = "dashboard-set-created"`, `DashboardSetCreatedDetail { set: DashboardSetRow }`, and `dispatchDashboardSetCreated(detail: DashboardSetCreatedDetail): void`.
  - Export `DASHBOARD_SET_UPDATED = "dashboard-set-updated"`, `DashboardSetUpdatedDetail { id: string; name: string }`, and `dispatchDashboardSetUpdated(detail: DashboardSetUpdatedDetail): void`.
- In `src/components/dashboard/SetDashboardGrid.tsx`:
  - Listen for `DASHBOARD_SET_CREATED` and prepend `detail.set` to `sets` state (avoiding duplicates if `id` already exists).
  - Dispatch `dispatchDashboardSetUpdated({ id, name: body.set.name })` after a successful rename in `saveRename()`.
- In `src/components/dashboard/StudyHero.tsx`:
  - Track `hasAnySets` in state initialized from `hasSets`; listen for `DASHBOARD_SET_CREATED` to set `hasAnySets = true` so the hero transitions from "Create your first set" to the active study hero when the user creates their first set inline from the generator.

#### 2. Generator Mode Switcher & Inline New Set Creation

**File**: `src/components/generator/FlashcardGenerator.tsx`

**Intent**: Add the **From text** / **From topic** segmented control, the topic input field with `MAX_TOPIC_CHARS` counter, and the **+ Create new set…** (`"__new__"`) option in the Save-to-set selector that creates the set via `/api/flashcard-sets/create` before saving drafts via `/api/flashcards/bulk-create`.

**Contract**:
- **Mode toggle state**:
  - `mode: "text" | "topic"` (default `"text"`).
  - `topic: string` (default `""`).
  - Switching `mode` preserves `cardsDraft` (does not clear drafts); clears any stale input validation `errorMessage`.
  - In `"text"` mode, renders the existing `<textarea>` with `textTrimmed.length / MAX_SOURCE_TEXT_CHARS`.
  - In `"topic"` mode, renders a Paper-styled `<input type="text">` (with `aria-label` / `<label>` bound to `t("generator.topic.label")`, `placeholder={t("generator.topic.placeholder")}`, and character counter `topicTrimmed.length / MAX_TOPIC_CHARS`) plus helper text `t("generator.topic.hint")`. Pressing `Enter` inside the topic input triggers `onGenerate()` when `canGenerate` is true.
- **`onGenerate()` behavior**:
  - Branches on `mode`:
    - `"text"`: validates `text.trim()` (`generator.error.paste_text`, `generator.error.text_max`) and sends `{ mode: "text", text: trimmed }` to `POST /api/ai/generate`.
    - `"topic"`: validates `topic.trim()` (`generator.error.enter_topic`, `generator.error.topic_max`) and sends `{ mode: "topic", topic: trimmed }` to `POST /api/ai/generate`.
  - On success, replaces `cardsDraft` with the newly generated drafts. If in `"topic"` mode and `selectedSetId === "__new__"` and the user has not manually edited `newSetName`, pre-fills `newSetName` with `topic.trim().slice(0, FLASHCARD_SET_NAME_MAX_LENGTH)`.
- **Target set selector & inline new set (`NEW_SET_OPTION_VALUE = "__new__"`)**:
  - Local `availableSets` state initialized from `sets` prop; listens to `DASHBOARD_SET_CREATED`, `DASHBOARD_SET_UPDATED`, and `DASHBOARD_SET_DELETED` so the dropdown stays in sync with `SetDashboardGrid`.
  - If `availableSets.length === 0`, `selectedSetId` defaults to `"__new__"` so a brand-new user with zero sets can immediately generate cards and save them to a new set!
  - The `<select>` includes `<option value="">{t("generator.choose_set_option")}</option>`, all `availableSets`, and `<option value="__new__">{t("generator.new_set_option")}</option>`.
  - When `selectedSetId === "__new__"`, renders an inline `<input type="text">` for `newSetName` (`maxLength={FLASHCARD_SET_NAME_MAX_LENGTH}`, labeled `t("generator.new_set_name.label")`, placeholder `t("generator.new_set_name.placeholder")`). When switching `selectedSetId` to `"__new__"` in `"topic"` mode and `newSetName.trim() === ""`, pre-fills `newSetName` with `topic.trim().slice(0, FLASHCARD_SET_NAME_MAX_LENGTH)`.
- **`onSave()` behavior**:
  - If `selectedSetId === "__new__"`:
    - Validates `validateFlashcardSetName(newSetName)`; if invalid, displays `flashcardSetErrorMessage(locale, validation.key)` and aborts.
    - Sends `POST /api/flashcard-sets/create` with `headers: { "Content-Type": "application/json", Accept: "application/json" }` and `body: JSON.stringify({ name: validation.name })`.
    - On `{ ok: true, set }`: adds `{ id: set.id, name: set.name }` to `availableSets`, sets `selectedSetId = set.id`, clears `newSetName`, and calls `dispatchDashboardSetCreated({ set: { ...set, card_count: 0, due_count: 0 } })`, then proceeds to `POST /api/flashcards/bulk-create` with `setId: set.id`.
  - On successful `bulk-create`: clears `text` (if in `"text"` mode) or `topic` (if in `"topic"` mode), clears `cardsDraft`, and dispatches `dispatchDashboardSetCardsAdded`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Linting passes: `npm run lint`
- Production SSR build succeeds: `npm run build`

#### Manual Verification:

- On `/dashboard` (in both PL and EN locales), expand **Generate flashcards with AI**, switch between **From text** and **From topic**, enter a topic, generate cards, edit/delete drafts, and save to both an existing set and a newly created inline set (`+ Create new set…`); verify the new set tile and card/due counts appear immediately in `SetDashboardGrid` and `StudyHero` without a page reload.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 3. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Playwright API Contract & E2E UI Verification

### Overview

Extend the Playwright API contract suite and E2E UI suite to cover topic-mode generation, privacy guarantees, and saving topic-generated drafts to an inline new set on `/dashboard`.

### Changes Required:

#### 1. Topic API Contract Tests (`e2e/ai-generate-api-contract.spec.ts`)

**File**: `e2e/ai-generate-api-contract.spec.ts`

**Intent**: Protect Risk #3 and Risk #5 for `{ topic }` requests on `POST /api/ai/generate`.

**Contract**: Add tests verifying:
- Guest `POST /api/ai/generate` with `{ mode: "topic", topic: "Photosynthesis" }` returns `401`.
- Authenticated empty topic `{ mode: "topic", topic: "   " }` returns `400`.
- Authenticated over-max topic (`MAX_TOPIC_CHARS + 1` with sentinel prefix) returns `400` without echoing the sentinel string in the response body.

#### 2. Topic UI & Inline New Set E2E Spec (`e2e/ai-generate-topic-ui.spec.ts`)

**File**: `e2e/ai-generate-topic-ui.spec.ts`

**Intent**: Verify in a real browser that a signed-in user on `/dashboard` can switch to **From topic**, generate flashcards (using a deterministic Playwright route mock on `**/api/ai/generate`), review/edit the draft cards, create a new set inline via **+ Create new set…**, and save the cards with live dashboard tile sync.

**Contract**:
- Intercepts `**/api/ai/generate`, asserts the request payload contains `{ mode: "topic", topic }`, and fulfills `200` with `{ ok: true, cards: [{ question: "...", answer: "..." }, { question: "...", answer: "..." }] }`.
- Navigates to `/dashboard`, expands the generator `<details>`, clicks the **From topic** / **Z tematu** tab, enters a topic, and clicks **Generate** / **Generuj**.
- Verifies the draft rows render, switches tabs to **From text** and back to **From topic** to confirm drafts are preserved across tab switches, selects **+ Create new set…** / **+ Utwórz nowy zestaw…**, enters a unique set name, and clicks **Save** / **Zapisz**.
- Verifies the success banner appears, drafts clear to `0/50`, and the newly created set tile appears in the dashboard grid with `2 cards · 2 due` (`2 fiszki · 2 do powtórki`).

#### 3. Test Plan Cookbook Update

**File**: `context/foundation/test-plan.md`

**Intent**: Record the new topic generation Vitest and Playwright coverage in `test-plan.md` §6 (AI generation contract row).

**Contract**: Update the `AI generation contract (OpenRouter)` row in `context/foundation/test-plan.md` §6 to reference topic-mode unit tests and `e2e/ai-generate-topic-ui.spec.ts`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Linting passes: `npm run lint`
- Production SSR build succeeds: `npm run build`
- Playwright E2E suite passes: `npm run test:e2e`

#### Manual Verification:

- Review Playwright test report and confirm all API contract and UI E2E tests pass cleanly.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `src/lib/openrouter-generate.test.ts`:
  - `generateFlashcardsFromTopic` sends `plugins: [{ id: "web", max_results: 5, search_prompt: ... }]` and `response_format: { type: "json_object" }`.
  - Handles valid wrapped JSON, bare array JSON, markdown-fenced JSON, invalid JSON, empty drafts (`generator.error.no_valid_drafts`), oversize fields, HTTP 500, timeout (`generator.error.timeout`), and missing `OPENROUTER_API_KEY`.
- `src/lib/ai-generate-handler.test.ts`:
  - Topic mode happy path (`200`, calls `generateFlashcardsFromTopic`, never echoes sentinel topic, never calls `supabase.from`).
  - Topic mode empty/whitespace (`400`, `generator.error.enter_topic`).
  - Topic mode over `MAX_TOPIC_CHARS` (`400`, `generator.error.topic_max`, never echoes input).
  - Unauthenticated topic request (`401`, never invokes generator).

### Integration / E2E Tests:

- `e2e/ai-generate-api-contract.spec.ts`:
  - Guest 401, authenticated empty topic 400, and authenticated over-max topic 400 without input echo.
- `e2e/ai-generate-topic-ui.spec.ts`:
  - End-to-end UI flow on `/dashboard`: switch to Topic mode → generate (mocked `/api/ai/generate`) → verify drafts survive tab switching → select `+ Create new set…` → save → verify new set tile and card counts in `SetDashboardGrid`.

### Manual Testing Steps:

1. Start `npm run dev` with a valid `OPENROUTER_API_KEY` in `.env` / `.dev.vars`.
2. Sign in and visit `/dashboard` in Polish (`pl`) and English (`en`).
3. Expand **Generate flashcards with AI**, switch to **From topic** (`Z tematu`), enter a topic (e.g. `"Fotosynteza — faza jasna i ciemna"` or `"HTTP/3 and QUIC protocol"`), and click **Generate**.
4. Verify ~8–12 factual Q&A cards appear in the language of the topic without raw markdown URL citations.
5. Edit one card, remove another, select **+ Create new set…**, confirm the set name pre-fills from the topic, click **Save**, and verify the new set appears in the dashboard grid with matching card and due counts.

## Performance Considerations

- Topic requests use `MAX_TOPIC_CHARS = 200` and cap web search results at `OPENROUTER_WEB_SEARCH_MAX_RESULTS = 5` with `google/gemini-2.5-flash-lite`, keeping end-to-end OpenRouter latency well within `OPENROUTER_REQUEST_TIMEOUT_MS = 30_000`.
- Inline set creation and dashboard tile updates run via client-side fetch + custom DOM events (`DASHBOARD_SET_CREATED`, `DASHBOARD_SET_CARDS_ADDED`), avoiding full-page SSR reloads.

## Migration Notes

- No database schema migrations or new environment variables/secrets are required; OpenRouter's Web Search plugin uses the existing `OPENROUTER_API_KEY`.

## References

- Roadmap slice S-13: `context/foundation/roadmap.md:274-288`
- Prior AI generation slice (S-02): `context/archive/2026-05-27-ai-generation-save/plan.md`
- Prior AI contract & privacy tests: `context/archive/2026-06-12-ai-generation-contract-privacy/plan-brief.md`
- Test plan cookbook: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend Topic Generation, Set Creation API & Unit Tests

#### Automated

- [x] 1.1 Unit tests pass: `npm test`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [x] 1.3 Code review confirms `POST /api/ai/generate` accepts both `{ text }` and `{ topic }` and `POST /api/flashcard-sets/create` returns `{ ok: true, set }` for JSON requests

### Phase 2: Dashboard Sync & Generator UI (Topic Tab + Inline New Set)

#### Automated

- [ ] 2.1 Unit tests pass: `npm test`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Production SSR build succeeds: `npm run build`

#### Manual

- [ ] 2.4 Topic mode generation and inline new-set save work in browser on `/dashboard` in both PL and EN locales with live tile sync

### Phase 3: Playwright API Contract & E2E UI Verification

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Production SSR build succeeds: `npm run build`
- [ ] 3.4 Playwright E2E suite passes: `npm run test:e2e`

#### Manual

- [ ] 3.5 Review Playwright test report and confirm all API contract and UI E2E tests pass cleanly
