---
change_id: topic-flashcard-generation
title: Topic flashcard generation — web search retrieval, draft review, and inline new-set save
status: implemented
created: 2026-10-29
updated: 2026-10-29
---

## Notes

Roadmap S-13 (`topic-flashcard-generation`). Adds a second AI generation input flow alongside pasted text: user enters a short topic (`MAX_TOPIC_CHARS = 200`), server queries OpenRouter `chat/completions` with the Web Search plugin (`plugins: [{ id: "web", ... }]`) and a custom `search_prompt` (preventing markdown URL injection into Q&A fields), returns validated `{ question, answer }` drafts for review (accept/edit/delete), and supports saving drafts to an existing set or creating a new set inline from `FlashcardGenerator` without reloading `/dashboard`.
