---
change_id: bilingual-ui
title: Bilingual ui
status: implementing
created: 2026-05-30
updated: 2026-06-01
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Contract update: locale sync at sign-in (2026-06-01)

The original plan stated "Do not update metadata on sign-in." This was revised after discovering that users who select a different language on the sign-in page (via the guest locale toggle) would have their choice ignored — `resolveLocale` always preferred `user_metadata.locale` over the cookie.

**Change:** `src/pages/api/auth/signin.ts` now calls `supabase.auth.updateUser({ data: { locale: cookieLocale } })` after successful sign-in when the cookie locale differs from user metadata. This ensures the pre-login language choice is respected and persisted.

**Scope:** This is a one-directional sync (cookie → metadata) that only fires at sign-in. There is still no in-app language toggle for authenticated users.

### Fix: `load-set-detail.ts` redirect error keys (2026-06-01)

Replaced hardcoded English strings ("Set not found", "Invalid set") in redirect URLs with error keys (`set_not_found`, `set_invalid`). Previously these strings were silently dropped by `resolveFlashcardSetErrorMessage` on the dashboard because they were not recognized as error keys — the user saw no feedback after redirect.
