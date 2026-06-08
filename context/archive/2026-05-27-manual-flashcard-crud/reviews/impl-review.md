<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manual flashcard CRUD (S-03) — Full slice

- **Plan**: context/changes/manual-flashcard-crud/plan.md
- **Scope**: Phases 1–4 (all Progress items `[x]`)
- **Date**: 2026-05-27
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Parent set touch errors are silent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/flashcard-set-touch.ts:4-6
- **Detail**: `touchFlashcardSetUpdatedAt` does not check Supabase `{ error }`. Card create/update/delete can succeed while `flashcard_sets.updated_at` stays stale. User confirmed 4.5 manually, so this is latent rather than observed in happy path.
- **Fix**: Check `{ error }` from the update; log on failure and optionally surface a non-blocking warning to the client.
  - Strength: Makes dashboard ordering reliable when touch fails.
  - Tradeoff: Slightly more handler code; still two round-trips without RPC.
  - Confidence: HIGH — straightforward Supabase pattern.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Card `updated_at` not bumped on update

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Data safety
- **Location**: src/pages/api/flashcards/update.ts:53-58
- **Detail**: Update sets only `question` and `answer`. No DB trigger on `flashcards.updated_at`; returned `updated_at` in API response stays at insert time. SRS fields correctly unchanged (1.5 verified).
- **Fix**: Add `updated_at: new Date().toISOString()` to the `.update()` payload (or add a migration trigger for all flashcard writes).
- **Decision**: FIXED

### F3 — Zod accepts unbounded strings before business validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/create.ts:12-16, update.ts:12-16
- **Detail**: `z.string()` has no `.max()` before `validateFlashcardDraft`. Very large bodies are parsed in memory first. Same pattern exists in `bulk-create.ts`.
- **Fix**: Use `z.string().max(MAX_CARD_FIELD_CHARS)` on question/answer fields (import from `ai-generation-limits`).
- **Decision**: FIXED (create + update)

### F4 — `bulk-create` does not touch parent set `updated_at`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/flashcards/bulk-create.ts (post-insert)
- **Detail**: Manual CRUD routes call `touchFlashcardSetUpdatedAt`; AI bulk save does not. Dashboard sort after AI save may not reflect activity. Out of S-03 file list but affects shared UX.
- **Fix**: Call `touchFlashcardSetUpdatedAt(supabase, parsed.data.setId)` after successful bulk insert.
- **Decision**: FIXED

### F5 — New cards prepended; SSR orders ascending

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/flashcards/SetFlashcardsManager.tsx:127-137
- **Detail**: Client prepends on create; `load-set-detail` orders by `created_at` ascending. Order changes after refresh.
- **Fix**: Append new cards at end or sort client list by `created_at` after create.
- **Decision**: FIXED

### F6 — Unbounded card list on set detail

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/load-set-detail.ts:49-53
- **Detail**: Single query loads all cards. Plan Performance section accepts this for MVP.
- **Fix**: Defer; add pagination when sets grow large.
- **Decision**: SKIPPED (MVP per plan)

### F7 — Benign extras vs plan file list

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/load-set-detail.ts, src/lib/flashcard-set-touch.ts, dashboard.astro
- **Detail**: Helpful extractions (`loadSetDetailPage`, `touchFlashcardSetUpdatedAt`) and monospace `set.id` under set names on dashboard (not in plan). All align with intent.
- **Fix**: Optional plan addendum documenting extras; no code change required.
- **Decision**: SKIPPED

## Automated verification

| Check | Result |
|-------|--------|
| `npm run lint` | PASS |
| `npm run build` | PASS |

## Manual verification (Progress)

All manual items 1.3–4.5 marked `[x]`; user confirmed API CRUD, RLS, UI flows, empty state, and parent `updated_at` on dashboard in session 2026-05-27.

## Plan adherence summary

| Phase | Status |
|-------|--------|
| 1 API + validation | MATCH |
| 2 FlashcardRow + SetFlashcardsManager | MATCH |
| 3 Set detail + nav + middleware | MATCH |
| 4 Empty state, guards, touch | MATCH |

No substantive drift. Allowed: create reuses `flashcardBulkCreateErrorMessage`; update uses `.maybeSingle()` for 404.
