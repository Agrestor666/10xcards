# Topic Flashcard Generation — Plan Brief

> Full plan: `context/changes/topic-flashcard-generation/plan.md`

## What & Why

Implement Roadmap slice **S-13 (`topic-flashcard-generation`)**: allow learners to generate flashcards by naming a topic (up to 200 characters, in Polish or English) when they don't have raw notes to paste. The server retrieves relevant facts via OpenRouter's Web Search plugin (`plugins: [{ id: "web" }]`), generates ~8–12 Q&A pairs in the topic's language, and presents them in the existing review gate (FR-005) before saving to a new or existing set.

## Starting Point

- `FlashcardGenerator.tsx` on `/dashboard` currently supports only pasted text (`MAX_SOURCE_TEXT_CHARS = 20_000`) via `POST /api/ai/generate` → `generateFlashcardsFromText`, and only allows saving to pre-existing sets.
- Creating a set via `NewSetDialog.tsx` reloads `/dashboard`, which wipes any unsaved draft cards in `FlashcardGenerator`.

## Desired End State

Inside `FlashcardGenerator`, users can switch between **From text** and **From topic** (preserving any existing drafts across tab switches), enter a topic, review/edit/remove the generated Q&A drafts, and save them either to an existing set or via **+ Create new set…** inline (pre-filled with the topic) with live dashboard tile updates and zero page reload.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Information retrieval | OpenRouter Web Search plugin (`plugins: [{ id: "web", max_results: 5, search_prompt: ... }]`) | Grounds cards in live web results using the existing `OPENROUTER_API_KEY` with zero new Worker secrets, while overriding `search_prompt` so default markdown citations don't pollute card text. |
| Source attribution (S-13 Unknown) | Q&A pairs only (no source metadata shown or stored) | Avoids a DB schema migration and reuses `FlashcardRow`, `validateFlashcardDrafts`, and `/api/flashcards/bulk-create` unchanged. |
| Generator UI layout | Segmented mode toggle (**From text** / **From topic**) inside `FlashcardGenerator` | Shares the draft review list and save controls without cluttering `/dashboard` with a second generator panel. |
| Save to new or existing set | Inline **+ Create new set…** option in the generator's set selector | Fulfils S-13's "save to a new or existing set" requirement and prevents `NewSetDialog`'s page reload from wiping unsaved drafts. |
| API route contract | Extend `POST /api/ai/generate` to accept `{ text }` or `{ topic }` | Reuses auth, 503, and Risk #3 privacy gates in `handleAiGenerateRequest` while keeping existing `{ text }` tests 100% backward-compatible. |
| Topic limits & card count | `MAX_TOPIC_CHARS = 200` + ~8–12 target cards in prompt | Keeps web search queries focused and fast while staying well within `MAX_CARDS_PER_REQUEST = 50`. |
| Tab-switch draft behavior | Keep `cardsDraft` when switching tabs; replace only on new **Generate** | Prevents accidental loss of edited drafts from a stray tab click. |
| Automated test scope | Full parity: Vitest unit/service/handler + Playwright API & UI E2E | Protects Risk #3/#4/#5 contracts for topic requests and verifies the UI tab toggle + inline new-set save in CI without live OpenRouter calls. |

## Scope

**In scope:**

- `generateFlashcardsFromTopic` in `src/lib/openrouter-generate.ts` using OpenRouter's `web` plugin + custom `search_prompt`
- Topic validation (`MAX_TOPIC_CHARS = 200`) in `src/lib/ai-generate-handler.ts` and `POST /api/ai/generate`
- JSON `{ name }` support and `{ ok: true, set }` response in `POST /api/flashcard-sets/create`
- Mode switcher (**From text** / **From topic**) and inline **+ Create new set…** flow in `FlashcardGenerator.tsx` with `DASHBOARD_SET_CREATED` sync
- Bilingual PL/EN copy (`src/lib/i18n/en.ts`, `src/lib/i18n/pl.ts`) and Vitest + Playwright tests

**Out of scope:**

- Storing or displaying source URLs/titles on flashcards; Supabase schema migrations
- External search provider API keys (Tavily/Brave/Serper)
- User-selectable card count control or auto-saving cards without user review

## Architecture / Approach

```
FlashcardGenerator ("text" | "topic" mode + inline "+ Create new set…")
  ├── POST /api/ai/generate ({ text } | { topic })
  │     └── handleAiGenerateRequest → generateFlashcardsFromText | generateFlashcardsFromTopic (plugins: [{ id: "web" }])
  ├── (optional) POST /api/flashcard-sets/create ({ name }) → dispatchDashboardSetCreated
  └── POST /api/flashcards/bulk-create ({ setId, cards }) → dispatchDashboardSetCardsAdded
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Backend & Unit Tests | `generateFlashcardsFromTopic`, `/api/ai/generate` topic branch, `/api/flashcard-sets/create` JSON `set` return, i18n keys, Vitest suite | OpenRouter default `search_prompt` injecting markdown links into answers (mitigated via custom `search_prompt`) |
| 2. Dashboard Sync & UI | `DASHBOARD_SET_CREATED` sync, mode toggle (**From text** / **From topic**), and inline **+ Create new set…** in `FlashcardGenerator` | Duplicate set creation if `bulk-create` fails after `create` succeeds (mitigated by immediately selecting the created `set.id`) |
| 3. Playwright API & E2E | Topic API 401/400/privacy contract tests + E2E UI test for topic generation & inline new-set save + `test-plan.md` update | React island hydration timing on `/dashboard` in Playwright (mitigated via `expect().toPass()` pattern) |

**Prerequisites:** `OPENROUTER_API_KEY` configured in `.env` / `.dev.vars` for manual verification (CI uses mocked OpenRouter responses).
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- OpenRouter's `{ id: "web" }` plugin adds ~2–4 seconds of search latency; the existing `OPENROUTER_REQUEST_TIMEOUT_MS = 30_000` easily accommodates this with `google/gemini-2.5-flash-lite`.
- Cards are generated in the language of the user's topic prompt (enforced via `TOPIC_SYSTEM_PROMPT`), independent of the UI locale (`pl` / `en`).

## Success Criteria (Summary)

- User can switch to **From topic**, enter a topic in PL or EN, review ~8–12 generated Q&A drafts, edit/remove cards, and save them to a new or existing set without reloading `/dashboard`.
- Invalid/empty/over-max topics and malformed upstream responses return safe localized errors without echoing the input or writing to Supabase.
- `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` all pass.
