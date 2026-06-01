---
change_id: bilingual-ui
title: Bilingual ui
status: archived
created: 2026-05-30
updated: 2026-06-01
archived_at: 2026-06-01T20:00:00Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Contract update: locale sync at sign-in (2026-06-01)

The original plan stated "Do not update metadata on sign-in." This was revised after discovering that users who select a different language on the sign-in page (via the guest locale toggle) would have their choice ignored — `resolveLocale` always preferred `user_metadata.locale` over the cookie.

**Change:** `src/pages/api/auth/signin.ts` now calls `supabase.auth.updateUser({ data: { locale: cookieLocale } })` after successful sign-in when the cookie locale differs from user metadata. This ensures the pre-login language choice is respected and persisted.

**Scope:** This is a one-directional sync (cookie → metadata) that only fires at sign-in. There is still no in-app language toggle for authenticated users.

### Fix: `load-set-detail.ts` redirect error keys (2026-06-01)

Replaced hardcoded English strings ("Set not found", "Invalid set") in redirect URLs with error keys (`set_not_found`, `set_invalid`). Previously these strings were silently dropped by `resolveFlashcardSetErrorMessage` on the dashboard because they were not recognized as error keys — the user saw no feedback after redirect.

### Locale delegation exceptions (Phase 4)

Phase 4's Changes Required listed `flashcard-set-name.ts` and `openrouter-generate.ts` under the "Each exported `*ErrorMessage(locale, error?)` signature" requirement. Both files intentionally do not export locale-accepting message functions:

- **`flashcard-set-name.ts`**: `validateFlashcardSetName` returns `{ ok: false; key: FlashcardSetNameValidationKey }`. Localization is delegated to `flashcard-set-errors.ts:flashcardSetErrorMessage(locale, key)` at call sites. Keeps validation concerns separate from message rendering.
- **`openrouter-generate.ts`**: `generateFlashcardsFromText` returns `{ ok: false; errorKey: string }`. Input-validation errors are localized server-side by `api/ai/generate.ts`; generation errors (`errorKey`) are localized client-side by `FlashcardGenerator.tsx`. The split reflects the generate endpoint's hybrid server+client architecture.

### i18n audit (Phase 4)

**Grep patterns** (run from repo root; review hits manually):

```bash
rg -n '"[A-Za-z][^"]{8,}"' src/components src/pages --glob '!**/i18n/**' --glob '!**/*.astro'
rg -n 'message: "[A-Z]' src/pages/api
rg -n 'Please sign in|Invalid request|Could not |not found\.' src
```

**Documented exceptions** (English allowed):

| Location | Reason |
| -------- | ------ |
| `src/lib/openrouter-generate.ts` | LLM system prompt (not user-facing UI) |
| `src/lib/i18n/en.ts` | English catalog source of truth |
| `DELETE` confirm token | Product invariant (account deletion) |
| Brand `10xCards` | Invariant name in copy keys |
| AI-generated flashcard Q/A | Out of scope (source text language) |
| `src/components/**` after Phase 4 | No user-facing English literals in feature islands; errors use `t()` or server `message` |

### Bilingual regression checklist (Phase 4)

Run after `npm run lint` and `npm run build`. Tick when verified.

**API errors (PL cookie / metadata)**

- [x] Logged in with PL: rename set to duplicate/conflict or empty name → Polish error in grid dialog
- [x] PL: AI generate with empty text → Polish validation (client) and API paste error if bypassed
- [x] PL: bulk save / add card permission denied (if testable) → Polish message, not raw Postgres text
- [x] PL: review session fetch failure → Polish load error (no English provider string)
- [x] EN: repeat smoke above → English messages match pre-i18n intent

**API errors (EN)**

- [x] Guest EN on landing → sign in → trigger rename validation → English messages

**Full journey (from Phase 3 manual — still required before archive)**

- [x] Full PL loop: `/` → sign up → dashboard → set → cards → review → settings → sign out
- [x] Full EN loop: parity with pre-i18n English
- [x] PL pluralization on dashboard hero (1 / 2 / 5 cards)
- [x] Delete-account dialog PL; confirm still types `DELETE`
