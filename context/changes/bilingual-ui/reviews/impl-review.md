<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bilingual UI (S-09)

- **Plan**: context/changes/bilingual-ui/plan.md
- **Scope**: Full plan — all phases (1–4)
- **Date**: 2026-06-01
- **Verdict**: REJECTED
- **Findings**: 1 critical | 6 warnings | 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Unguarded updateUser call can break sign-in redirect

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:23
- **Detail**: The locale-sync `updateUser` call is awaited with no surrounding try/catch. If Supabase throws (network hiccup, rate limit, or session edge case), the exception bubbles up uncaught and the `redirect("/dashboard")` on line 26 never executes. The user authenticated successfully but the request fails before they reach the dashboard. This is a live regression risk on any Supabase transient error — the sign-in contract (authenticated session → redirect) breaks for a side-effect operation.
- **Fix A ⭐ Recommended**: Wrap lines 22–24 in try/catch, swallow error
  - Strength: Matches the "best-effort sync" intent documented in change.md; locale not set is far less harmful than sign-in broken.
  - Tradeoff: Silently swallowed errors could mask a misconfiguration; add a DEV `console.warn` if desirable.
  - Confidence: HIGH — identical try/catch guard pattern used in `src/pages/api/locale.ts:29–31` for the Referer URL parse.
  - Blind spot: None significant.
- **Fix B**: Use `.catch(() => {})` inline (one-liner): `await supabase.auth.updateUser(...).catch(() => {});`
  - Strength: Minimal diff, same safety.
  - Tradeoff: Slightly less readable; harder to add a DEV log later.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — try/catch added around updateUser call

---

### F2 — flashcard-sets/create.ts returns errorKey while all other Phase 4 routes return message

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence / Pattern Consistency
- **Location**: src/pages/api/flashcard-sets/create.ts:24–65
- **Detail**: Every other API route in Phase 4 scope (delete, update, flashcards/*, srs/*, dashboard/due-summary, delete-account, ai/generate) calls `getLocaleFromContext` and returns `{ ok: false, message: t(locale, key) }`. `create.ts` is the only outlier: it never calls `getLocaleFromContext` and returns `{ ok: false, errorKey }` to JSON consumers. The client (NewSetDialog in SetDashboardGrid) must localise the key itself — or silently render an untranslated key string if the client-side mapping is incomplete.
- **Fix A ⭐ Recommended**: Add `getLocaleFromContext` + return `message` (same treatment as `delete.ts`/`update.ts`)
  - Strength: Closes the inconsistency; server controls the locale; direct precedents in sibling files.
  - Tradeoff: Need to verify NewSetDialog handles `message` not `errorKey`; likely a one-line client change.
  - Confidence: HIGH — delete.ts/update.ts are direct precedents.
  - Blind spot: SetDashboardGrid/NewSetDialog client side must be read to confirm it uses `body.message`.
- **Fix B**: Document the intentional pattern divergence in change.md
  - Strength: Zero code change; preserves the hybrid redirect+JSON contract of create.ts.
  - Tradeoff: API surface inconsistency remains; future implementers may copy the wrong pattern.
  - Confidence: MEDIUM.
  - Blind spot: Haven't verified if any callers rely on `errorKey`.
- **Decision**: FIXED via Fix A — create.ts updated to call getLocaleFromContext and return message; NewSetDialog.tsx updated to use body.message

---

### F3 — flashcard-set-name.ts and openrouter-generate.ts plan locale contract unmet

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/flashcard-set-name.ts, src/lib/openrouter-generate.ts
- **Detail**: Phase 4's Changes Required explicitly lists both files under "Each exported `*ErrorMessage(locale, error?)` signature". Neither exports a locale-accepting message function. `flashcard-set-name.ts` exports `validateFlashcardSetName` returning `{ ok: false; key }` — localization delegated to `flashcard-set-errors.ts`. `openrouter-generate.ts` exports `generateFlashcardsFromText` returning `{ ok: false; errorKey }` — localization split between the API route (input validation errors) and the React client (generation errors). Both delegations work functionally and no English leaks were found. The design is not documented in the plan.
- **Fix**: Acknowledge in change.md — append a note that these two files intentionally delegate locale to call-sites, and the plan's wording was overly broad.
  - Strength: Zero code change; updates the source of truth.
  - Tradeoff: Plan text and implementation remain technically mismatched.
  - Confidence: HIGH — functional verification confirms no user-visible English leaks from either delegation.
  - Blind spot: None.
- **Decision**: FIXED — note added to change.md documenting intentional delegation pattern for both files

---

### F4 — LocaleProvider context value recreated on every render

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/i18n/LocaleProvider.tsx
- **Detail**: The context value `{ locale, t }` is a new object literal on every render. React performs reference equality on context values — every re-render of `LocaleProvider` causes all `useLocale()` consumers to re-render, even when locale hasn't changed. In practice locale is stable (never changes post-mount), but this is a latent performance trap as more consumers are added.
- **Fix**: Wrap value in `useMemo`: `const value = useMemo(() => ({ locale, t }), [locale]);`
  - Strength: Standard React pattern; eliminates unnecessary consumer re-renders; one-line change.
  - Tradeoff: Adds one import.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED — useMemo added

---

### F5 — getLocaleFromContext has no null/undefined guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/locale.ts (getLocaleFromContext)
- **Detail**: `getLocaleFromContext` returns `context.locals.locale` directly without a fallback. If middleware didn't run (early return, future middleware refactor, test context without middleware), `context.locals.locale` is `undefined` but the return type is `AppLocale`. TypeScript trusts the annotation; callers pass `undefined` to `t()` which falls back to the raw key string — a silent degradation that is hard to diagnose in production.
- **Fix**: `return context.locals.locale ?? DEFAULT_LOCALE;`
  - Strength: Defensive; consistent with how `resolveLocale` itself handles the final fallback.
  - Tradeoff: Masks a genuine middleware misconfiguration; consider adding a DEV assertion.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED — ?? DEFAULT_LOCALE fallback added

---

### F6 — tPlural uses runtime-constructed key cast as MessageKey

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/i18n/index.ts (tPlural)
- **Detail**: `tPlural` constructs keys like `key + "_one"`, `key + "_few"`, `key + "_many"`, `key + "_other"` at runtime and casts them `as MessageKey`. TypeScript cannot verify the cast — a caller that passes a key prefix without `_one`/`_few`/`_many` variants in the dictionaries silently degrades: DEV shows a `console.warn` with the raw key string; prod returns the raw key string to the user. Since `tPlural` is the primary mechanism for PL plural forms, a typo in a key prefix is invisible at compile time.
- **Fix A ⭐ Recommended**: Add DEV-only assertion guard for variant coverage
  ```ts
  if (import.meta.env.DEV) {
    const variants = ["_one", "_few", "_many", "_other"] as const;
    for (const v of variants)
      if (!en[(key + v) as MessageKey])
        console.warn(`tPlural: missing variant "${key}${v}" in en.ts`);
  }
  ```
  - Strength: Catches prefix typos at dev time; zero prod overhead; same pattern as existing missing-key `console.warn` in `resolveText`.
  - Tradeoff: Doesn't restore TypeScript compile-time safety; only surfaces at runtime in DEV.
  - Confidence: HIGH.
  - Blind spot: Only runs if the DEV path is actually hit.
- **Fix B**: Extract `PluralMessageKeyBase` union type and constrain `tPlural`'s key param to it
  - Strength: Full TypeScript safety; typos become compile errors.
  - Tradeoff: Requires maintaining a separate type union; higher maintenance burden.
  - Confidence: MEDIUM — viable but may be overkill for MVP scale.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — DEV-only assertion guard added to tPlural in i18n/index.ts

---

### F7 — confirm-email.astro missing ?error= param handling

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/auth/confirm-email.astro
- **Detail**: Phase 2 groups `confirm-email.astro` with signin/signup for the `?error=` query-param → `t()` mapping requirement. The page has no error display surface, receives no error redirects in practice (it is a success terminal page), and has no form. No user-visible impact. Plan contract is technically unmet.
- **Fix**: Either add a one-line guard for completeness, or add an inline note in the plan acknowledging the page has no error display surface.
- **Decision**: FIXED — note added to plan.md contract for Phase 2 auth pages

---

### F8 — dialog.tsx English "Close" default leaks to screen readers

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/ui/dialog.tsx:32
- **Detail**: `DialogContent` accepts `closeLabel?: string` with English default `"Close"`. The prop exists (plan criterion satisfied), but all callers must actively pass a translated value. Any Phase 3 island that opens a dialog without passing `closeLabel` renders the English sr-only "Close" regardless of locale — only visible to screen reader users. An audit of Phase 3 dialog callers would confirm full coverage.
- **Fix**: Audit Phase 3 dialog callers to ensure each passes `closeLabel={t(locale, "common.close")}`, or change the default to require the prop explicitly.
- **Decision**: SKIPPED — audit confirmed both DialogContent callers (NewSetDialog, SetDashboardGrid) already pass closeLabel={t("a11y.close")}; no leak in practice
