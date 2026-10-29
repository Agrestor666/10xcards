# Photo Flashcard Generation Implementation Plan

## Overview

Add a third generator input on `/dashboard`: up to three photos of written text (camera or file), an editable combined transcript, then 8–12 flashcard drafts reviewed and saved through the existing gate. Roadmap slice S-14 (`photo-flashcard-generation`).

## Current State Analysis

`FlashcardGenerator` supports `text` and `topic` only. Both call `POST /api/ai/generate`, which returns cards. Text mode uses an open-ended prompt; topic mode asks for about 8–12 cards. Draft review, inline new-set save, and `POST /api/flashcards/bulk-create` already exist.

There is no image upload, camera capture, or OCR. `generateFlashcardsFromText` sends the user message as a string, so it cannot carry an image. The default model `google/gemini-2.5-flash-lite` does accept images on OpenRouter chat completions. Source text is not stored; the generate handler must not call `supabase.from` or echo the input.

## Desired End State

A signed-in user opens **From photo**, adds one to three pictures (file picker or camera), sees previews, and presses **Read text**. The server transcribes each picture. Empty reads are dropped. The user edits one combined transcript, then generates about 8–12 cards in the language of that text, edits or removes cards, and saves them to a new or existing set. The image is never stored. Paste and topic flows behave as they do today.

### Key Discoveries:

- Card generation is `POST /api/ai/generate` → `handleAiGenerateRequest` → `generateFlashcardsFromText` / `generateFlashcardsFromTopic` (`src/lib/openrouter-generate.ts`).
- OpenRouter image input is a content array: text part first, then `image_url` as a data URL. Types: jpeg, png, webp, gif. Public image URLs are for public files only.
- Privacy tests in `src/lib/ai-generate-handler.test.ts` assert the sentinel is absent from the response and `supabase.from` is not called.
- UI E2E mocks `**/api/ai/generate` in the browser (`e2e/ai-generate-topic-ui.spec.ts`). API contract E2E covers 401/400 gates only, not a live model call.
- `selectMode` clears the error and keeps `cardsDraft`.

## What We're NOT Doing

- PDF, DOCX, TXT, or PPTX import
- Storing the photo, the data URL, or the transcript in the database, KV, or logs
- Tesseract, a second OCR vendor, or the Wrangler `IMAGES` binding
- Replacing **From text** or **From topic**
- One-shot “image → cards” that skips the edited transcript
- More than three photos, user-picked card count, or drag-and-drop reorder
- Turnstile on this flow
- A native camera app
- Prefilling the new-set name from the transcript

## Implementation Approach

Two server steps, because they return different shapes and the user edits the text in between.

1. `POST /api/ai/transcribe` accepts 1–3 images and returns combined text plus the 1-based indexes of photos that had no readable text.
2. `POST /api/ai/generate` with `{ mode: "transcript", text }` turns that edited string into about 8–12 cards.

Per-image vision calls are required so a blank photo can be skipped by index. A single multi-image prompt cannot tell the client which photo was empty. Each call uses `google/gemini-2.5-flash-lite` and the same 30s timeout. Run the calls in parallel. An empty or whitespace transcript skips that photo. A transport error, timeout, or unexpected response shape fails the whole read with the existing generate error key — do not treat an outage as an empty photo and do not return a partial transcript.

The client resizes every file to JPEG (longest edge 1600px, quality 0.8) before building the data URL, and refuses a result larger than 1.5 MB decoded. The server checks the same byte cap, the photo count, and an allowed image data-URL mime. `request.json()` buffers the body, so the cap has to hold before the Worker holds three raw camera photos.

**From text** stays on its current prompt. The 8–12 cap lives only on `mode: "transcript"`.

## Critical Implementation Details

- **Empty versus failure.** Whitespace-only model output skips that index. Any thrown or non-OK vision call fails the request with 502 and `generator.error.timeout` or `generator.error.generate`. If every photo is skipped, respond 400 with a localized “no readable text” message and no image payload.
- **Order.** Concatenate non-skipped transcripts in request order, separated by a blank line. The editor shows that string. Photo numbers in the skip message match the order the user added them, including skipped ones (photo 2 of 3 can be the blank).
- **Privacy.** Do not log request bodies. Error and success JSON must not contain the data URL or a copy of a rejected oversize payload. Do not call `supabase.from` on transcribe or on transcript generation.
- **Vision message shape.** No `response_format` on the transcribe call. User content is an array: a text instruction, then the image.

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "<transcribe exactly, including handwriting; original language and line breaks; if nothing is readable, return an empty message and no explanation>" },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
  ]
}
```

## Phase 1: Server read and transcript cards

### Overview

The API can transcribe up to three images and can turn an edited transcript into about 8–12 drafts, with the same auth and privacy gates as today’s generate route. No dashboard UI in this phase.

### Changes Required:

#### 1. Limits

**File**: `src/lib/ai-generation-limits.ts`

**Intent**: Name the photo caps next to the existing text and topic caps so client, server, and E2E stay in sync.

**Contract**: `MAX_PHOTO_COUNT = 3`. `MAX_PHOTO_BYTES = 1_500_000` (decoded image bytes, not the length of the data URL). `MAX_PHOTO_EDGE_PX = 1600` for the client resizer. Transcript text keeps `MAX_SOURCE_TEXT_CHARS`.

#### 2. Vision transcribe and transcript card prompt

**File**: `src/lib/openrouter-generate.ts`

**Intent**: Read one image into plain text, and generate 8–12 cards from an edited transcript, without changing the paste or topic prompts.

**Contract**: `transcribeImage(dataUrl: string)` returns `{ ok: true, text: string }` or the existing `{ ok: false, errorKey }` result. The prompt asks for a verbatim transcript, including handwriting, in the source language; if nothing is readable, the model returns an empty message and no commentary. `generateFlashcardsFromTranscript(text: string)` uses a system prompt that asks for 8–12 cards in the language of the text, JSON only, no URLs. It still goes through `requestOpenRouterCards` and `validateFlashcardDrafts`.

#### 3. Transcribe handler and route

**File**: `src/lib/ai-transcribe-handler.ts`

**File**: `src/pages/api/ai/transcribe.ts`

**Intent**: Authenticated JSON endpoint that validates images, transcribes them in parallel, skips blanks, and never persists anything.

**Contract**: `POST` body `{ images: string[] }`. 401 reuses `api.error.sign_in_generate`. 400 when `images` is missing, empty, longer than `MAX_PHOTO_COUNT`, not a `data:image/(jpeg|png|webp|gif);base64,` URL, or any image’s decoded bytes exceed `MAX_PHOTO_BYTES`. 400 when every image transcribes to whitespace, with a new i18n key for “no readable text”. 200 `{ ok: true, text: string, skipped: number[] }` where `skipped` is 1-based indexes. 502 uses the same `errorKey` values as generate. The route exports `prerender = false` and passes injected transcribe functions the way `generate.ts` injects generators, so tests do not call OpenRouter.

#### 4. Transcript mode on generate

**File**: `src/lib/ai-generate-handler.ts`

**File**: `src/pages/api/ai/generate.ts`

**Intent**: Let the edited transcript produce cards without changing `{ mode: "text" }` or `{ mode: "topic" }`.

**Contract**: `{ mode: "transcript", text: string }` trims, rejects empty with the existing paste-text message, rejects over `MAX_SOURCE_TEXT_CHARS` with the existing text-max message, and calls `generateFlashcardsFromTranscript`. A body that mixes `transcript` with `topic`, or sends both `text` and `topic` without a disambiguating mode, stays 400. Wire the new function from `generate.ts` the same way as `generateFlashcardsFromTopic`.

#### 5. Copy for API errors

**File**: `src/lib/i18n/en.ts`

**File**: `src/lib/i18n/pl.ts`

**Intent**: Localized messages for the new 400s. UI chrome waits until Phase 2.

**Contract**: Add the “no readable text” key and any transcribe-specific invalid-body copy the handler returns. Keep both dictionaries in lockstep. Do not change existing generator strings.

#### 6. Unit tests

**File**: `src/lib/ai-transcribe-handler.test.ts`

**File**: `src/lib/openrouter-generate.test.ts`

**File**: `src/lib/ai-generate-handler.test.ts`

**Intent**: Lock privacy, skip behavior, and backward compatibility without a live model.

**Contract**: Transcribe tests: 401; invalid mime; four images; oversize body does not echo the payload; one blank and one text → 200 with `skipped: [n]` and the readable text only; all blank → 400; one vision failure → 502 and no `text` field; `supabase.from` never called. OpenRouter test: transcribe request uses a content array with text then `image_url`, and does not set `response_format`. Generate tests: `mode: "transcript"` calls the transcript generator, not the paste generator; existing text and topic cases stay green.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- With `OPENROUTER_API_KEY` in local dev, one small JPEG sent to `POST /api/ai/transcribe` returns text, and a blank image in a two-image body shows up only in `skipped`. No new database row appears.

**Implementation Note**: After automated verification passes, pause for the manual check before Phase 2.

---

## Phase 2: Photo mode in the generator

### Overview

The dashboard generator gains **From photo**: previews, an explicit read, one editable transcript, then the existing draft list and save controls.

### Changes Required:

#### 1. Resize files in the browser

**File**: `src/lib/photo-prep.ts`

**Intent**: Turn a picked or captured file into a JPEG data URL the transcribe route will accept.

**Contract**: Longest edge at most `MAX_PHOTO_EDGE_PX`, JPEG quality 0.8. If the decoded JPEG is still over `MAX_PHOTO_BYTES`, return a typed failure the UI maps to a localized error. Do not upload the original camera file.

#### 2. Third mode in the generator

**File**: `src/components/generator/FlashcardGenerator.tsx`

**Intent**: Collect up to three photos, read them on demand, let the user fix the text, then generate drafts with the transcript mode.

**Contract**: Extend `GeneratorMode` with `"photo"`. `selectMode` still only clears the error and keeps `cardsDraft`. Photo UI: add from file (multiple) and from camera (`capture`), thumbnail list in add order, remove a photo, disable add at three. **Read text** is enabled only when there is at least one photo and a read is not in flight. It `POST`s `{ images }` to `/api/ai/transcribe`. On 200, fill a textarea with `text` and, when `skipped` is non-empty, show which photo numbers had no text. The user can edit the textarea up to `MAX_SOURCE_TEXT_CHARS`. **Generate** in photo mode sends `{ mode: "transcript", text }` of the edited textarea, not the images. Empty edited text uses the paste-empty message. Save, inline new set, and draft rows stay as they are. Do not prefill the new-set name from the transcript. Switching away and back keeps the transcript and the photos in component state. A new successful **Generate** replaces `cardsDraft`, same as text and topic.

#### 3. Bilingual chrome

**File**: `src/lib/i18n/en.ts`

**File**: `src/lib/i18n/pl.ts`

**Intent**: Every new control and error has an English and a Polish string.

**Contract**: Mode label, add-from-file, add-from-camera, read button, reading progress, skip message with photo numbers, photo count and size errors, transcript field label. Card language still follows the transcript, not the UI locale.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- On `/dashboard`, add a photo of printed text, read it, edit a word, generate, and save into an existing set. Draft questions match the edited text, not the raw photo.
- Add three photos, remove the middle one, read again. The transcript order matches the remaining photos.
- A photo with no words is listed as skipped, and the other photo’s text is still editable.
- **From text** and **From topic** still generate and save. Switching modes does not wipe existing drafts.
- The same screen is usable in PL and EN, on a narrow viewport, without horizontal scrolling.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: API gates and dashboard E2E

### Overview

CI covers the new routes’ rejection gates and the photo UI with mocked app routes, including a file fixture. A real camera and a handwritten page stay manual.

### Changes Required:

#### 1. API contract tests

**File**: `e2e/ai-generate-api-contract.spec.ts`

**Intent**: Extend the existing gate file so guest and bad photo payloads fail closed without a live vision call.

**Contract**: Guest `POST /api/ai/transcribe` returns 401. Authenticated empty `images`, four images, and an oversize data URL return 400, and the oversize body does not contain a sentinel planted in the payload. Guest `POST /api/ai/generate` with `{ mode: "transcript", text }` returns 401. Authenticated empty and over-max transcript text return 400 without echoing the sentinel. Do not assert a successful live transcription here.

#### 2. Dashboard UI test

**File**: `e2e/ai-generate-photo-ui.spec.ts`

**Intent**: Prove the photo path reaches drafts and that drafts survive a mode switch, using a tiny fixture image and route mocks.

**Contract**: Mock `**/api/ai/transcribe` and `**/api/ai/generate`. Follow the hydration retry pattern in `e2e/ai-generate-topic-ui.spec.ts` (`expect().toPass()`). Choose **From photo**, attach one fixture JPEG through the file input, read, see the mocked transcript in the editor, change it, generate, and see the mocked draft questions. Switch to **From text** and back. Drafts remain. The generate mock is called with `{ mode: "transcript", text }` equal to the edited string. Camera capture is not automated.

### Success Criteria:

#### Automated Verification:

- End-to-end tests pass: `npm run test:e2e`
- Unit tests pass: `npm test`

#### Manual Verification:

- On a phone browser, take a photo with the camera control and get an editable transcript.
- A handwritten Polish note produces text the user can correct before cards appear. Poor handwriting is a quality risk, not a second pipeline.
- In devtools, the transcribe response JSON has `text` and `skipped` only — no data URL.

**Implementation Note**: After automated verification, pause for the manual camera and handwriting check.

---

## Testing Strategy

### Unit Tests:

- Transcribe validation, skip indexes, all-blank 400, vision failure 502, no `supabase.from`, no echoed image
- Vision request shape: text part, then `image_url`, no JSON response format
- `mode: "transcript"` is dispatched separately from paste and topic
- Existing text and topic handler tests stay unchanged and green

### Integration Tests:

- Playwright API gates for transcribe and transcript mode (401/400, no echo)
- Playwright UI with mocked `/api/ai/transcribe` and `/api/ai/generate`

### Manual Testing Steps:

1. Read one printed photo locally and confirm a transcript comes back.
2. Save cards from an edited transcript into an existing set.
3. Skip behavior with one blank and one readable photo.
4. Regression: paste text and topic generation.
5. Phone camera, then a handwritten page.
6. Confirm the transcribe response does not contain the image.

## Performance Considerations

Each vision call and the later card call have their own 30s timeout. Parallel reads mean three photos wait about as long as the slowest one, not the sum. The UI already disables the action and shows an in-flight state; the read button needs the same, because a photo read will often exceed the 2s progress NFR that applies to generation. The 10s perceived target for a short paste does not apply to vision. The byte cap is what keeps `request.json()` inside Worker memory.

## Migration Notes

No schema change. Nothing to backfill. Rollback is removing the photo mode and the transcribe route; saved cards are ordinary `question` / `answer` rows.

## References

- Related research: `context/changes/photo-flashcard-generation/research.md`
- Roadmap slice: `context/foundation/roadmap.md` S-14
- Similar implementation: `context/changes/topic-flashcard-generation/plan.md`
- OpenRouter image inputs: https://openrouter.ai/docs/guides/overview/multimodal/image-understanding
- Privacy pattern: `src/lib/ai-generate-handler.test.ts`
- UI E2E pattern: `e2e/ai-generate-topic-ui.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server read and transcript cards

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — c67e4a3
- [x] 1.2 Lint passes: `npm run lint` — c67e4a3

#### Manual

- [x] 1.3 With `OPENROUTER_API_KEY` in local dev, one small JPEG sent to `POST /api/ai/transcribe` returns text, and a blank image in a two-image body shows up only in `skipped`. No new database row appears. — c67e4a3

### Phase 2: Photo mode in the generator

#### Automated

- [x] 2.1 Unit tests pass: `npm test`
- [x] 2.2 Lint passes: `npm run lint`
- [x] 2.3 Production build passes: `npm run build`

#### Manual

- [x] 2.4 On `/dashboard`, add a photo of printed text, read it, edit a word, generate, and save into an existing set. Draft questions match the edited text, not the raw photo.
- [x] 2.5 Add three photos, remove the middle one, read again. The transcript order matches the remaining photos.
- [x] 2.6 A photo with no words is listed as skipped, and the other photo’s text is still editable.
- [x] 2.7 **From text** and **From topic** still generate and save. Switching modes does not wipe existing drafts.
- [x] 2.8 The same screen is usable in PL and EN, on a narrow viewport, without horizontal scrolling.

### Phase 3: API gates and dashboard E2E

#### Automated

- [ ] 3.1 End-to-end tests pass: `npm run test:e2e`
- [ ] 3.2 Unit tests pass: `npm test`

#### Manual

- [ ] 3.3 On a phone browser, take a photo with the camera control and get an editable transcript.
- [ ] 3.4 A handwritten Polish note produces text the user can correct before cards appear. Poor handwriting is a quality risk, not a second pipeline.
- [ ] 3.5 In devtools, the transcribe response JSON has `text` and `skipped` only — no data URL.
