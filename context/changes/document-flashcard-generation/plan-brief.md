# Document Flashcard Generation — Plan Brief

> Full plan: `context/changes/document-flashcard-generation/plan.md`

## What & Why

Roadmap S-15 lets a signed-in learner make flashcards from one document: PDF, DOC, DOCX, TXT, or PPTX. The file is only a way to get text. The learner fixes that text, then reviews about 20 cards before anything is saved.

## Starting Point

`FlashcardGenerator` on `/dashboard` already has **From text**, **From topic**, and **From photo**. Photo reads images through `POST /api/ai/transcribe`, then generates 8–12 cards from the edited transcript. Nothing parses a document. Generate and transcribe accept JSON only, and source text is not stored.

## Desired End State

The user adds one file (10 MB, and for PDF or PPTX at most 20 pages or slides), presses **Read text**, and edits the extract. **Generate** stays off until the text is at most 20_000 characters, then produces about 20 cards in the language of that text. Cards go through the same review and save path as the other modes. The file is not stored. A scanned PDF is read too.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Scanned PDF | Read it in this slice | A scan is a normal study file, and the current model accepts a PDF directly. |
| After the read | Editable text, then **Generate** | A bad extract is fixed before it becomes bad cards, same as photo. |
| Text longer than 20_000 characters | Show up to 100_000 characters; **Generate** stays disabled until the user shortens it | The user chooses the passage, and the existing generate cap stays. |
| How big | One file, 10 MB, and 20 PDF pages or PPTX slides | A lecture or chapter fits; a textbook must be split. |
| How many cards | About 20 | More coverage than a photo page, still one reviewable list. A new generate replaces the current drafts. |
| Where text is extracted | On the server: `unpdf` / Office parsers, and the model only when a PDF page has almost no text | Workers cannot rasterize PDF pages, and the file never needs a public URL or a database row. |
| Pictures inside DOC, DOCX, PPTX | Not OCR'd | Scan support was decided for PDF. Those formats return their text layer or a no-text error. |

## Scope

**In scope:**

- `POST /api/ai/read-document` for one PDF, DOC, DOCX, TXT, or PPTX
- `{ mode: "document", text }` on `POST /api/ai/generate` for about 20 cards
- **From document** in `FlashcardGenerator`: file, read, edit, character gate, generate, existing save
- PL/EN strings, Vitest, Playwright API gates, Playwright UI with mocked routes

**Out of scope:**

- Replacing paste, topic, or photo; storing the file; XLSX, images, audio, video, archives; more than one file; OCR of pictures inside Office files; Turnstile; a model migration

## Architecture / Approach

```
FlashcardGenerator ("document")
  ├── multipart POST /api/ai/read-document { file }
  │     ├── text-layer PDF, DOC, DOCX, PPTX, TXT → plain text
  │     └── sparse PDF page → one OpenRouter PDF transcript
  ├── user edits one textarea (Generate only if ≤ 20_000 chars)
  ├── POST /api/ai/generate { mode: "document", text }
  └── existing draft review + POST /api/flashcards/bulk-create
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Server read and document cards | Read route and document card mode, with unit tests | Treating a blank trailing PDF page as a scan and sending a good text-layer file to the model |
| 2. Document mode in the generator | Fourth dashboard mode through save | Posting the file as base64 JSON and blowing Worker memory |
| 3. API gates and dashboard E2E | 401/400 contracts and a mocked UI path | Playwright clicking before the dashboard island hydrates |

**Prerequisites:** `OPENROUTER_API_KEY` for a real scanned PDF. CI mocks the app routes and does not call OpenRouter.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- A PDF with one sparse page (often a blank last page) is transcribed by the model instead of the text layer. The transcript can be less literal than `unpdf`.
- The 60s PDF read can still time out on a dense 20-page scan. The button stays in a visible progress state, and the error is a timeout, not an empty document.
- Google published a retirement date of 2026-10-20 for `gemini-2.5-flash-lite`. This plan keeps that model. If OpenRouter stops serving it, document scans and the existing photo flow fail together. Replacing the model is out of scope.
- Legacy `.doc` depends on `word-extractor` under `nodejs_compat`. If that import breaks the Worker build, switch only that parser to a WASM reader (`office-oxide-wasm`). Do not drop `.doc`.

## Success Criteria (Summary)

- The user can read one allowed file, fix the text, generate about 20 cards, and save them without a page reload.
- A scanned PDF returns editable text. A file over 10 MB, a PDF over 20 pages, or an extract over 100_000 characters fails without storing or echoing the file.
- Paste, topic, and photo generation still pass their current tests.
