---
change_id: data-schema-rls
title: Supabase schema and RLS for flashcard_sets and flashcards (F-01)
status: archived
created: 2026-05-26
updated: 2026-06-05
archived_at: 2026-06-05T18:36:09Z
---

## Notes

F-01 from @roadmap.md

Phase 1 complete: `supabase/migrations/20260526211944_flashcard_schema.sql` (schema only; RLS in Phase 2).

Phase 2 complete: RLS enabled on `flashcard_sets` and `flashcards` with per-operation `authenticated` policies (owner via `user_id` / owned set `EXISTS`).

Phase 3 complete: `src/types.ts` (`FlashcardSet`, `Flashcard`, insert types); README documents local migration workflow and remote `db push`.
