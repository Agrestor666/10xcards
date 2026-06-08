# Manual flashcard CRUD (S-03) — Plan Brief

> Full plan: `context/changes/manual-flashcard-crud/plan.md`

## What & Why

Users need a fallback when AI generation is insufficient or they want targeted cards: manually add, edit, and delete saved flashcards inside a set (FR-006, FR-008, FR-009, US-02). This slice completes the post-save card lifecycle that S-02's bulk save starts but does not manage.

## Starting Point

F-01 schema + RLS and S-01 dashboard (set list/create) exist. Bulk card insert works via `POST /api/flashcards/bulk-create` for AI save. There is no set detail page, no single-card API routes, and no persisted edit/delete UI. Validation helpers and JSON API conventions from S-02 server work are reusable.

## Desired End State

A signed-in user clicks a set on `/dashboard`, opens `/sets/<id>`, and manages cards with an inline add form at the top plus per-row inline edit and delete-with-confirm. All mutations use JSON APIs with inline success/error feedback in a React island. A shared `FlashcardRow` component is ready for S-02's draft preview.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| CRUD location | Set detail page `/sets/[id]` | S-01 deferred detail; US-02 requires "viewing a named flashcard set" | Plan |
| UI stack | React island on Astro SSR page | Inline edit/delete needs client state; matches S-02 direction | Plan |
| Edit UX | Inline edit + per-row Save | Consistent with planned S-02 draft editing; minimal navigation | Plan |
| Delete UX | Confirm before delete | Prevents accidental data loss on must-have delete (FR-009) | Plan |
| API style | JSON `fetch` from island | Matches bulk-create/AI routes; fits React state updates | Plan |
| S-02 sharing | Extract `FlashcardRow` now | Roadmap risk: avoid duplicating inline-edit logic across slices | Plan |
| Feedback | Inline banner in island | Keeps user on set page; no redirect friction | Plan |
| Add flow | Inline form at top of list | Primary action visible; matches US-02 "manual creation form" | Plan |

## Scope

**In scope:**
- `POST /api/flashcards/create`, `update`, `delete` JSON routes
- `validateFlashcardDraft()` + mutation error mappers
- `FlashcardRow` (persisted + draft modes) + `SetFlashcardsManager` island
- `/sets/[id].astro` page with server-loaded cards
- Dashboard links to sets; middleware protection for `/sets`
- Empty state, double-submit guards, optional parent set `updated_at` touch

**Out of scope:**
- Set rename/delete, SRS review (S-04), AI generator UI (S-02)
- Soft delete, card reorder, pagination, automated tests

## Architecture / Approach

```
/dashboard ──link──► /sets/[id].astro (SSR: set + cards query)
                              │
                              ▼
                    SetFlashcardsManager (React)
                      ├── add form → POST /api/flashcards/create
                      └── FlashcardRow × N
                            ├── Save → POST /api/flashcards/update
                            └── Delete (confirm) → POST /api/flashcards/delete
```

Auth via Supabase SSR cookies on every API call; RLS enforces ownership — client never sends `user_id`. `FlashcardRow` accepts a `mode` prop so S-02 can reuse it for draft cards with `onRemove` instead of persisted save/delete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API + validation | create/update/delete endpoints | Update must not clobber SRS fields |
| 2. Shared components | FlashcardRow + SetFlashcardsManager | Draft vs persisted prop API must stay stable for S-02 |
| 3. Set detail page | `/sets/[id]`, dashboard links, middleware | Invalid UUID / foreign set id handling |
| 4. Hardening | Empty state, RLS checks, updated_at polish | `updated_at` may need explicit set touch if no trigger |

**Prerequisites:** F-01 (schema + RLS) and S-01 (dashboard sets) complete.
**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- S-02 generator UI is not built yet — `FlashcardRow` draft mode is designed but not consumed until S-02 Phase 2.
- FR-008/FR-009 have no PRD-level acceptance criteria beyond "can edit/delete"; inline confirm + immediate list update is the assumed bar.
- Card list loads all rows — fine for MVP; pagination deferred.

## Success Criteria (Summary)

- User adds a card with non-empty Q+A; it appears in the set list immediately (US-02 AC).
- User edits and deletes saved cards with clear inline feedback.
- Cross-user access to sets/cards is blocked by RLS with user-safe errors.
