# Document Flashcard Generation Implementation Plan

## Overview

Add a fourth generator input on `/dashboard`: one PDF, DOC, DOCX, TXT, or PPTX becomes editable text, then about 20 flashcard drafts reviewed and saved through the existing gate. Roadmap slice S-15 (`document-flashcard-generation`).

## Current State Analysis

`FlashcardGenerator` supports `text`, `topic`, and `photo`. Photo is two steps: `POST /api/ai/transcribe` returns text, the user edits it, then `POST /api/ai/generate` with `{ mode: "transcript", text }` asks for 8–12 cards. Draft review, inline new-set save, and `POST /api/flashcards/bulk-create` already exist. `selectMode` keeps `cardsDraft`.

There is no document parser and no multipart upload on the AI routes. Generate and transcribe accept JSON only. The model `google/gemini-2.5-flash-lite` receives a string or an image data URL. Source text is not stored. Handlers must not call `supabase.from` or echo the input on errors.

`MAX_SOURCE_TEXT_CHARS` is 20_000. `OPENROUTER_REQUEST_TIMEOUT_MS` is 30_000 and is shared by every OpenRouter call. `nodejs_compat` is already enabled. The Worker has no canvas, so a PDF page cannot be rasterized there.

## Desired End State

A signed-in user opens **From document**, chooses one file up to 10 MB (PDF and PPTX also up to 20 pages or slides), and presses **Read text**. The server returns the document’s text, including a scanned or mixed PDF. The user edits that text. **Generate** stays disabled until the text is non-empty and at most 20_000 characters, then produces about 20 cards in the language of the text. The user reviews and saves them to a new or existing set. The file is never stored. Paste, topic, and photo behave as they do today.

### Key Discoveries:

- Card generation is `POST /api/ai/generate` → `handleAiGenerateRequest` (`src/lib/ai-generate-handler.ts`). `{ mode: "transcript", text }` is the photo path and must keep its 8–12 prompt (`src/lib/openrouter-generate.ts`).
- `unpdf` `extractText` returns one string per page and runs on Workers. `renderPageAsImage` needs a canvas and must not be called on Workers.
- OpenRouter chat completions accept a private PDF as a base64 `file` part. Gemini 2.5 Flash-Lite accepts `application/pdf` up to 50 MB and 1,000 pages, which covers this slice’s 10 MB / 20 page cap. A public file URL would require storing the PDF.
- `mammoth.extractRawText({ buffer })` reads DOCX and does not read legacy DOC. `word-extractor` reads a DOC `Buffer` and does not need a filesystem path. PPTX is a zip of slide XML.
- Photo’s “no readable text” copy mentions photos (`generator.error.no_readable_text`). Document failures need their own keys.
- Privacy tests in `src/lib/ai-generate-handler.test.ts` and `src/lib/ai-transcribe-handler.test.ts` assert `supabase.from` is not called and that error JSON does not echo the payload.

## What We're NOT Doing

- Replacing **From text**, **From topic**, or **From photo**
- Storing the file, the extracted text, or the model transcript in the database, KV, R2, or logs
- OCR of pictures embedded in DOC, DOCX, or PPTX (scan support is PDF-only)
- XLSX, images, audio, video, archives, or more than one file
- Rasterizing PDF pages on the Worker, Tesseract, or a second OCR vendor
- A user-picked card count, or changing the transcript mode’s 8–12 prompt
- Prefilling the new-set name from the filename or the extracted text
- Turnstile on this flow
- Rewriting the PRD non-goal that still says paste-only
- Migrating off `google/gemini-2.5-flash-lite`

## Implementation Approach

Two server steps, with the user editing the text in between.

1. `POST /api/ai/read-document` accepts one multipart file and returns plain text.
2. `POST /api/ai/generate` with `{ mode: "document", text }` turns the edited string into about 20 cards.

Extraction stays on the server so the privacy tests, the page cap, and the scan path have one place to live. The client does not parse the file.

- **TXT:** UTF-8 decode.
- **DOCX:** `mammoth.extractRawText`.
- **DOC:** `word-extractor` on a `Buffer`. A zip uploaded as `.doc` is a DOCX and is read as one.
- **PPTX:** unzip in memory and collect slide text in slide order.
- **PDF:** `unpdf` per page. If every page has at least 40 characters of text, join those pages and do not call the model. If any page is shorter, send the original PDF once as an OpenRouter `file` part and use that transcript instead of the text layer. That covers a pure scan and a mixed PDF. A trailing blank page is enough to take the model path.

The inbound body is `multipart/form-data` with a single `file` field. A 10 MB file as base64 JSON would inflate by about a third before parsing starts. `request.formData()` keeps the raw bytes.

Text returned to the browser is capped at 100_000 characters. Above that the route responds 400 and does not include the text. At or below that, the editor shows the whole extract. **Generate** is a separate gate at `MAX_SOURCE_TEXT_CHARS` (20_000). The user deletes text until the button enables.

## Critical Implementation Details

- **Do not rasterize.** `unpdf` `renderPageAsImage` has no canvas on Workers. Scans go to the model as the PDF file.
- **Sparse page rule.** Trim each page. A page under 40 characters counts as sparse. One or more sparse pages means one model transcript of the whole file, and the text-layer strings are discarded for that response. Zero sparse pages means the joined text layer and no model call. Check `totalPages` before the model call and reject above 20.
- **PDF file part.** Fixed filename `document.pdf`. Do not send the user’s filename. No `response_format`. Ask for a verbatim transcript in the source language, including handwriting, with line breaks, and an empty message when nothing is readable. Ignore OpenRouter file annotations. The client receives only `{ ok: true, text }`.

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "<verbatim transcript; original language and line breaks; empty message if nothing is readable>" },
    {
      "type": "file",
      "file": {
        "filename": "document.pdf",
        "file_data": "data:application/pdf;base64,..."
      }
    }
  ]
}
```

- **Timeout.** The PDF model read uses 60_000 ms. Every other OpenRouter call, including `{ mode: "document" }` card generation, keeps `OPENROUTER_REQUEST_TIMEOUT_MS` (30_000). A timeout is 502 `generator.error.timeout`, not an empty document.
- **Password and corrupt files.** A password-protected PDF fails on `unpdf` with a dedicated error and is not sent to the model. A corrupt or mismatched file is 400. Library error messages must not be copied into the response.
- **Office and text files have no page count.** DOC, DOCX, and TXT are limited by 10 MB and by the 100_000 character ceiling. PPTX is limited by 10 MB, 20 slides, and the same character ceiling.
- **Privacy.** Do not log the body. Error JSON must not contain file bytes, the data URL, or the extracted text. Do not call `supabase.from`.

## Phase 1: Server read and document cards

### Overview

The API can read one document into text and can turn an edited document text into about 20 drafts, with the same auth and privacy gates as generate. No dashboard UI in this phase.

### Changes Required:

#### 1. Limits

**File**: `src/lib/ai-generation-limits.ts`

**Intent**: Name the document caps next to the photo caps so the client, server, and tests share one source.

**Contract**: `MAX_DOCUMENT_BYTES = 10_485_760` (raw file bytes). `MAX_DOCUMENT_PAGES = 20` (PDF pages and PPTX slides). `MAX_DOCUMENT_EXTRACT_CHARS = 100_000` (text returned by the read route). `PDF_PAGE_TEXT_MIN_CHARS = 40`. `DOCUMENT_READ_TIMEOUT_MS = 60_000` for the PDF model read only. Card generation still uses `MAX_SOURCE_TEXT_CHARS` and `OPENROUTER_REQUEST_TIMEOUT_MS`.

#### 2. Format readers

**File**: `src/lib/document-text.ts`

**Intent**: Turn one in-memory file into plain text, or into a signal that the PDF must be transcribed by the model, without network I/O.

**Contract**: Input is the raw bytes plus a sniffed kind: `pdf`, `doc`, `docx`, `pptx`, or `txt`. Sniff magic bytes (`%PDF`, OLE `D0 CF 11 E0`, zip `PK`); the extension only chooses between DOCX and PPTX for a zip, and allows TXT. A zip with a `.doc` name is DOCX. Output is `{ ok: true, text: string }`, `{ ok: true, needsPdfTranscript: true, totalPages: number }`, or `{ ok: false, errorKey }`. PDF page count above `MAX_DOCUMENT_PAGES`, PPTX slide count above `MAX_DOCUMENT_PAGES`, a password-protected PDF, a non-UTF-8 TXT, and an empty extract are failures. Joined PDF or slide text keeps reading order and separates pages or slides with a blank line. This module does not call OpenRouter and does not import `renderPageAsImage`.

#### 3. PDF transcript and document card prompt

**File**: `src/lib/openrouter-generate.ts`

**Intent**: Transcribe one PDF file, and generate about 20 cards from edited document text, without changing the paste, topic, or transcript prompts.

**Contract**: `transcribePdf(bytes: Uint8Array)` returns `{ ok: true, text: string }` or `{ ok: false, errorKey }`. It uses `DOCUMENT_READ_TIMEOUT_MS` and the file part above. `generateFlashcardsFromDocument(text: string)` uses a system prompt that asks for about 20 cards in the language of the text, JSON only, no URLs. It still goes through the existing card parser and `validateFlashcardDrafts`. Add an optional timeout argument to the shared completion helper; the default stays 30_000.

#### 4. Read handler and route

**File**: `src/lib/ai-read-document-handler.ts`

**File**: `src/pages/api/ai/read-document.ts`

**Intent**: Authenticated multipart endpoint that validates one file, extracts text, and never persists anything.

**Contract**: `POST` with one `file` field. The route exports `prerender = false`. 401 reuses `api.error.sign_in_generate`. 400 when the body is not multipart, the field is missing, more than one file is sent, the extension is not `pdf`, `doc`, `docx`, `txt`, or `pptx`, the magic bytes disagree, or the raw size exceeds `MAX_DOCUMENT_BYTES`. 400 when extract text is empty or longer than `MAX_DOCUMENT_EXTRACT_CHARS` (the long case must not include the text). 400 for too many pages or slides, a password-protected PDF, and an unsupported or corrupt file, each with its own i18n key. 200 `{ ok: true, text: string }`. 502 uses the same `errorKey` values as generate when the PDF model call fails. When the reader returns `needsPdfTranscript`, call `transcribePdf` and treat a whitespace transcript as the empty-text 400. Inject the reader and `transcribePdf` so tests do not call OpenRouter. Do not call `supabase.from`.

#### 5. Document mode on generate

**File**: `src/lib/ai-generate-handler.ts`

**File**: `src/pages/api/ai/generate.ts`

**Intent**: Let the edited document text produce cards without changing `text`, `topic`, or `transcript`.

**Contract**: `{ mode: "document", text: string }` trims, rejects empty with the existing paste-text message, rejects over `MAX_SOURCE_TEXT_CHARS` with the existing text-max message, and calls `generateFlashcardsFromDocument`. A `document` body that also includes `topic` is 400. Wire the new function from `generate.ts` the same way as `generateFlashcardsFromTranscript`.

#### 6. Copy for API errors

**File**: `src/lib/i18n/en.ts`

**File**: `src/lib/i18n/pl.ts`

**Intent**: Localized messages for the new 400s. UI chrome waits until Phase 2.

**Contract**: New keys for too large, too many pages, too long to return, unsupported type, password-protected, and no readable text in the document. Do not reuse `generator.error.no_readable_text` (that string is about photos). Keep both dictionaries in lockstep.

#### 7. Unit tests

**File**: `src/lib/document-text.test.ts`

**File**: `src/lib/ai-read-document-handler.test.ts`

**File**: `src/lib/ai-generate-handler.test.ts`

**File**: `src/lib/openrouter-generate.test.ts`

**Intent**: Lock the reader, the read route’s auth and privacy gates, and the new generate mode.

**Contract**: Reader tests use in-memory fixtures (a text PDF, a PDF with a sparse page, a DOCX, a PPTX, a TXT, a legacy DOC if a tiny fixture is practical) and assert page order, the sparse-page signal, the page cap, and password failure. Handler tests assert 401, oversize, extra file, unsupported type, empty text, over-long text absent from the body, `supabase.from` not called, and no file bytes in error JSON. A sparse PDF calls the injected transcriber once. Generate tests assert `mode: "document"` is classified, capped at 20_000 characters, and does not change the existing text, topic, and transcript cases. The document prompt test asserts the request asks for about 20 cards and that the PDF call uses `DOCUMENT_READ_TIMEOUT_MS` and `filename: "document.pdf"`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- With `OPENROUTER_API_KEY` set, a text PDF returns text without needing a scan-quality read, a scanned PDF returns a transcript, and a DOCX returns its paragraphs
- A PDF over 20 pages, a password-protected PDF, and an unsupported type return a localized error and do not echo the file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Document mode in the generator

### Overview

`/dashboard` gains **From document**: choose one file, read it, edit the text, generate about 20 cards, and save through the current review gate.

### Changes Required:

#### 1. Document mode UI

**File**: `src/components/generator/FlashcardGenerator.tsx`

**Intent**: Add a fourth mode that posts the file, shows the returned text in an editor, and generates cards only from that edited string.

**Contract**: Extend `GeneratorMode` and `GENERATOR_MODES` with `document` and `generator.mode.document`. One `<input type="file">` accepts `.pdf,.doc,.docx,.txt,.pptx`. **Read text** posts `FormData` with a single `file` to `POST /api/ai/read-document`. The client refuses a file larger than `MAX_DOCUMENT_BYTES` before the request. Success fills one textarea. **Generate** sends `{ mode: "document", text }` and stays disabled while the trimmed text is empty or longer than `MAX_SOURCE_TEXT_CHARS`. Show the current length against 20_000 whenever the text is over the gate, and keep the full returned text visible so the user can delete. `selectMode` still keeps `cardsDraft`. Drop the `File` from state after a successful read. Saving still uses the existing new-set and `bulk-create` path. Do not prefill the new-set name.

#### 2. Mode and editor copy

**File**: `src/lib/i18n/en.ts`

**File**: `src/lib/i18n/pl.ts`

**Intent**: Name the mode and the read/editor controls in both languages.

**Contract**: Add the mode label, the file button, the read button, the reading state, and the over-20_000 helper that includes the current count and the max. Keep both dictionaries in lockstep.

### Success Criteria:

#### Automated Verification:

- Unit tests still pass: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard`, a signed-in user can read one file, edit the text, generate cards, and save them to an existing set and to a new set without a reload
- **Generate** stays disabled above 20_000 characters and enables after the user shortens the text
- Switching among text, topic, photo, and document does not drop existing drafts
- The new strings appear in Polish and in English

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: API gates and dashboard E2E

### Overview

CI covers the read route’s auth and validation gates and a mocked dashboard path, without calling OpenRouter.

### Changes Required:

#### 1. API contract spec

**File**: `e2e/ai-read-document-api-contract.spec.ts`

**Intent**: Lock the HTTP gates the handler tests already describe, at the route.

**Contract**: Follow `e2e/ai-generate-api-contract.spec.ts`. Cover 401 without a session, 400 for a missing file, an unsupported type, and an oversize body, and assert the error body does not contain a sentinel planted in the file. Do not require a live model.

#### 2. Dashboard UI spec

**File**: `e2e/ai-generate-document-ui.spec.ts`

**Intent**: Prove the mode switch, the read, the 20_000 gate, generate, and save with mocked routes.

**Contract**: Follow `e2e/ai-generate-photo-ui.spec.ts`. Mock `POST /api/ai/read-document` and `POST /api/ai/generate`. Assert the generate request is `{ mode: "document", text }` with the edited text, that a mock over 20_000 characters leaves **Generate** disabled, and that save still posts `bulk-create`. Wait for the dashboard island the same way the photo spec does.

### Success Criteria:

#### Automated Verification:

- New Playwright specs pass: `npx playwright test e2e/ai-read-document-api-contract.spec.ts e2e/ai-generate-document-ui.spec.ts`
- Unit tests pass: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- One real scanned PDF read from the dashboard UI, with `OPENROUTER_API_KEY` set, produces editable text and then cards
- A short pass over **From text**, **From topic**, and **From photo** still generates drafts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Sniff and extract each allowed format; reject a mismatched magic, a password-protected PDF, and a page or slide count over 20
- A sparse PDF page selects the model path once; a fully textual PDF does not
- Read handler: auth, size, empty, over 100_000 characters with the text omitted, no `supabase.from`, no file bytes in errors
- `mode: "document"` caps at 20_000 and leaves `text`, `topic`, and `transcript` unchanged
- The PDF request uses a 60s timeout and the filename `document.pdf`

### Integration Tests:

- Playwright API gates for `POST /api/ai/read-document` (401 and 400, no live model)
- Playwright UI: mocked read, character gate, `{ mode: "document" }` generate, and save

### Manual Testing Steps:

1. Read a text-layer PDF and confirm the text matches the file closely enough to edit.
2. Read a scanned PDF and confirm the transcript is editable before **Generate**.
3. Read a DOCX and a PPTX within the caps, and a TXT.
4. Confirm a file over 10 MB and a PDF over 20 pages fail with a localized error.
5. Paste more than 20_000 characters into the editor and confirm **Generate** is disabled until the text is shortened.
6. Save accepted cards to an existing set and to a new set, then confirm text, topic, and photo still work.

## Performance Considerations

A 10 MB PDF is held as raw bytes and, only on the scan path, as one base64 string for the outbound model call. That stays well under the Worker’s 128 MB memory limit because the body is multipart, not a base64 JSON upload. The scan path is one 60s model call, not one call per page. Text-layer PDFs and Office files do not call the model at read time. Card generation remains a separate 30s call and only sends the edited text, up to 20_000 characters.

## Migration Notes

No database migration. No new Worker secret. The read path uses the existing `OPENROUTER_API_KEY` only when a PDF has a sparse page.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-15)
- Two-step read-then-edit pattern: `context/archive/2026-10-29-photo-flashcard-generation/plan.md`
- Generate classification: `src/lib/ai-generate-handler.ts`
- Limits: `src/lib/ai-generation-limits.ts`
- Generator modes: `src/components/generator/FlashcardGenerator.tsx`
- OpenRouter PDF file part: chat completions `type: "file"` with a base64 `file_data` data URL
- `unpdf` `extractText` for per-page text; do not call `renderPageAsImage` on Workers
- `mammoth.extractRawText({ buffer })` for DOCX

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server read and document cards

#### Automated

- [x] 1.1 Unit tests pass: `npm test`
- [x] 1.2 Lint passes: `npm run lint`

#### Manual

- [x] 1.3 With `OPENROUTER_API_KEY` set, a text PDF returns text without needing a scan-quality read, a scanned PDF returns a transcript, and a DOCX returns its paragraphs
- [x] 1.4 A PDF over 20 pages, a password-protected PDF, and an unsupported type return a localized error and do not echo the file

### Phase 2: Document mode in the generator

#### Automated

- [ ] 2.1 Unit tests still pass: `npm test`
- [ ] 2.2 Lint passes: `npm run lint`

#### Manual

- [ ] 2.3 On `/dashboard`, a signed-in user can read one file, edit the text, generate cards, and save them to an existing set and to a new set without a reload
- [ ] 2.4 **Generate** stays disabled above 20_000 characters and enables after the user shortens the text
- [ ] 2.5 Switching among text, topic, photo, and document does not drop existing drafts
- [ ] 2.6 The new strings appear in Polish and in English

### Phase 3: API gates and dashboard E2E

#### Automated

- [ ] 3.1 New Playwright specs pass: `npx playwright test e2e/ai-read-document-api-contract.spec.ts e2e/ai-generate-document-ui.spec.ts`
- [ ] 3.2 Unit tests pass: `npm test`
- [ ] 3.3 Lint passes: `npm run lint`

#### Manual

- [ ] 3.4 One real scanned PDF read from the dashboard UI, with `OPENROUTER_API_KEY` set, produces editable text and then cards
- [ ] 3.5 A short pass over **From text**, **From topic**, and **From photo** still generates drafts
