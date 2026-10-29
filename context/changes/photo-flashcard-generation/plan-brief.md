# Photo Flashcard Generation — Plan Brief

> Full plan: `context/changes/photo-flashcard-generation/plan.md`
> Research: `context/changes/photo-flashcard-generation/research.md`

## What & Why

Roadmap S-14 lets a signed-in learner make flashcards from a photo of written text, taken with the camera or chosen from files. The photo is only a way to get text. The learner fixes that text, then reviews cards before anything is saved.

## Starting Point

`FlashcardGenerator` on `/dashboard` already has **From text** and **From topic**, both via `POST /api/ai/generate`, plus draft edit/remove and save to a new or existing set. The model is `google/gemini-2.5-flash-lite` on OpenRouter. It can accept images, but the app only sends a string. Nothing stores source text or files.

## Desired End State

The user adds up to three photos, presses **Read text**, edits one combined transcript, and generates about 8–12 cards in the language of that text. Blank photos are skipped and named. Cards go through the same review and save path as paste and topic. The image is not stored.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| How to read the photo | Same OpenRouter model, image as a base64 data URL, text instruction first | The model already accepts images; a public URL or a second OCR engine would store or add a vendor the privacy rule forbids. | Research |
| After the read | Show one editable transcript, then generate cards | A bad read is fixed before it becomes bad cards. | Plan |
| How many photos | Up to three, one text box, in add order | A single editor stays reviewable; order is the order the user added them. | Plan |
| How many cards | About 8–12, like topic mode | A full page should not dump up to 50 drafts. Paste mode keeps its own open-ended prompt. | Plan |
| Unreadable photo | Skip that photo and keep the others | One blank shot should not throw away the readable ones. | Plan |
| When the model runs | Preview first, then **Read text** | Each read is a vision call; capture alone must not spend it. | Plan |
| Which photo was blank | Separate vision call per image, in parallel | One multi-image prompt cannot report a skipped index. | Plan |
| Outage versus blank | Empty text skips; HTTP, timeout, or bad shape fails the whole read | An outage must not look like a blank photo and must not return a partial transcript. | Plan |
| Image size | Client JPEG, longest edge 1600px, 1.5 MB decoded cap, checked again on the server | `request.json()` buffers the body; a raw camera photo will blow Worker memory. | Research |

## Scope

**In scope:**

- `POST /api/ai/transcribe` for 1–3 images, with skip indexes
- `{ mode: "transcript", text }` on `POST /api/ai/generate` for 8–12 cards
- **From photo** in `FlashcardGenerator`: file, camera, previews, read, edit, generate, existing save
- PL/EN strings, Vitest, Playwright API gates, Playwright UI with mocked routes

**Out of scope:**

- File import (PDF, DOCX, TXT, PPTX), storing images or transcripts, Tesseract, replacing paste or topic, more than three photos, Turnstile on this flow

## Architecture / Approach

```
FlashcardGenerator ("photo")
  ├── resize to JPEG in the browser
  ├── POST /api/ai/transcribe { images }
  │     └── per image: OpenRouter vision → text or skip
  ├── user edits one textarea
  ├── POST /api/ai/generate { mode: "transcript", text }
  └── existing draft review + POST /api/flashcards/bulk-create
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Server read and transcript cards | Transcribe route and transcript card mode, with unit tests | Treating a model error as an empty photo and hiding a failed read |
| 2. Photo mode in the generator | Third dashboard mode through save | Large camera files posted before resize |
| 3. API gates and dashboard E2E | 401/400 contracts and a mocked UI path | Playwright clicking before the dashboard island hydrates |

**Prerequisites:** `OPENROUTER_API_KEY` for the Phase 1 manual read. CI mocks the app routes and does not call OpenRouter.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Handwriting quality on this model is unmeasured. Printed and handwritten text share one prompt; the editable transcript is the mitigation.
- Three parallel vision calls can still take most of the 30s timeout. The read button stays in a visible progress state.

## Success Criteria (Summary)

- The user can read up to three photos, fix the text, generate about 8–12 cards, and save them without a page reload.
- A blank photo is named and skipped; a failed vision call does not return a partial transcript or store anything.
- Paste and topic generation still pass their current tests.
