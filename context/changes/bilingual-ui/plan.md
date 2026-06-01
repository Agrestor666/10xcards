# Bilingual UI (S-09) Implementation Plan

## Overview

Add Polish and English UI for all user-facing routes. Guests pick PL or EN on the landing topbar (or get a browser default from `Accept-Language`); after signup the locale is frozen — no in-app language switch. Implementation uses a lightweight typed dictionary + `t()` helper (no i18n library), middleware-resolved `Astro.locals.locale`, cookie + `user_metadata.locale` hybrid persistence, and localized server error mappers.

## Current State Analysis

**Prerequisites met:** S-07 (`study-hub-ui`) and S-08 (`unified-paper-ui`, `impl_reviewed`) — all routes use paper theme on a consistent shell.

**No i18n today:**

- `src/layouts/Layout.astro:14` — `<html lang="en">` hardcoded
- `src/middleware.ts` — auth guards only; no locale cookie or `locals.locale`
- `src/env.d.ts` — `Locals` has `user` only
- ~210–240 unique English UI strings across 14 Astro pages, 8 top-level React islands, and 8 `src/lib/*` error modules
- Dev config banner in `Layout.astro` / `config-status.ts` is hardcoded Polish (misaligned with EN product copy)

**React islands** (`client:load`) do not receive locale today — props are domain data only (`dashboard.astro:49–64`, auth forms `serverError` only).

**Signup** does not set metadata: `src/pages/api/auth/signup.ts:13` calls `signUp({ email, password })` with no `options.data`.

### Key Discoveries:

- EN landing copy spec: `context/changes/study-hub-ui/landing-copy.md` (variant A) — PL translation source of truth for hero
- Auth errors pass raw Supabase `error.message` in query string (`signin.ts`, `signup.ts`) — must become stable error keys for localization
- Client and server duplicate some error text (e.g. `SetDashboardGrid.tsx` vs `flashcard-set-errors.ts`) — Phase 4 centralizes via locale-aware mappers
- `ReviewSession.tsx` uses `toLocaleString()` without locale — pass `AppLocale` for date formatting
- Account deletion confirm token stays `"DELETE"` (invariant per account-deletion plan and user decision)
- Legacy accounts without `user_metadata.locale`: resolve via cookie → `Accept-Language` → `en`; no metadata backfill

## Desired End State

- Guest on `/` sees **PL | EN** segmented toggle in `AppTopbar` (guest branch only); selection sets cookie and re-renders page in chosen language
- First visit without cookie: middleware detects `Accept-Language` (`pl*` → PL, else EN), sets cookie, sets `Astro.locals.locale`
- Direct `/auth/signin` or `/auth/signup` without landing visit: same detect + cookie behavior
- After signup: `user_metadata.locale` snapshot from cookie; logged-in requests prefer metadata over cookie
- All routes localized: `/`, auth, `/dashboard`, `/sets/<id>`, `/sets/<id>/review`, `/settings`
- `<html lang="pl|en">` and page titles follow locale
- Common API / lib error strings return localized text when locale is known
- Known Supabase auth errors mapped to localized messages; unknown → generic fallback
- **No** language switch in settings or authenticated topbar
- Verification: `npm run lint`, `npm run build`, manual PL/EN smoke checklist in `change.md`

## What We're NOT Doing

- More than two locales
- Language change after login (no settings/topbar toggle)
- Translating AI-generated flashcard content (card Q/A = source text language)
- Full ICU-style date/number localization beyond existing `toLocaleString(locale)` call sites
- Error-code JSON API refactor (keep localized `message` strings in responses)
- Metadata backfill for pre-S-09 accounts
- Localized account-deletion confirm token (stays `DELETE`)
- Automated test suite (none in repo)
- Database migrations or RLS changes

## Implementation Approach

1. **Phase 1 — Infrastructure:** locale types, cookie + Accept-Language resolution in middleware, `t()` dictionaries, signup snapshot, dynamic `lang`, locale API route for topbar toggle
2. **Phase 2 — Landing + auth:** guest topbar toggle, `Welcome.astro`, auth pages/islands, confirm-email, auth error key mapping
3. **Phase 3 — App surfaces:** `AppTopbar` (authenticated copy), dashboard, sets, review, settings islands via `LocaleProvider` + translated strings
4. **Phase 4 — Server messages + audit:** locale param on `*-errors.ts` and API routes, dev banner alignment, grep audit for stray English, bilingual regression checklist

## Critical Implementation Details

**Middleware resolution order (logged-in):** `user.user_metadata.locale` (if `en`|`pl`) → `locale` cookie → `Accept-Language` → `en`. For guests, skip metadata step. On first visit when no valid cookie exists, middleware **sets** the cookie from Accept-Language so SSR and subsequent requests agree.

**Signup snapshot:** Read locale from the same resolution helper in `signup.ts` **before** `signUp`; pass `options: { data: { locale } }`. Do not update metadata on sign-in.

**Auth error redirect contract:** API routes redirect with `?error=<ErrorKey>` (e.g. `invalid_credentials`, `email_taken`, `supabase_unconfigured`) instead of raw provider text. Astro pages map keys through `t()` before passing to `ServerError`.

**React hydration:** Pass `locale` as a serializable prop from Astro to each island root; island wraps children in `LocaleProvider`. Do not read cookies client-side for copy — avoids SSR/client mismatch.

## Phase 1: Locale infrastructure

### Overview

Establish locale detection, persistence, translation helper, and layout `lang` attribute. No user-visible copy changes beyond wiring.

### Changes Required:

#### 1. Locale core module

**File**: `src/lib/locale.ts` (new)

**Intent**: Single source for locale type, cookie name, Accept-Language parsing, and read/write helpers used by middleware, API routes, and pages.

**Contract**: Export `AppLocale = "en" | "pl"`, `LOCALE_COOKIE = "locale"`, `DEFAULT_LOCALE = "en"`, `parseAcceptLanguage(header: string | null): AppLocale` (`pl*` → `pl`), `isAppLocale(value: unknown): value is AppLocale`, `getLocaleFromCookies(cookies: AstroCookies): AppLocale | null`, `setLocaleCookie(cookies: AstroCookies, locale: AppLocale): void`, `resolveLocale(input: { user: User | null; cookies: AstroCookies; acceptLanguage: string | null }): AppLocale`.

#### 2. Translation dictionaries

**File**: `src/lib/i18n/en.ts`, `src/lib/i18n/pl.ts`, `src/lib/i18n/index.ts` (new)

**Intent**: Typed message catalogs and `t(locale, key, params?)` helper. Start with keys needed for Phase 1–2 (meta, locale labels, auth errors); expand in Phases 3–4.

**Contract**: `MessageKey` union type covering all keys (grows per phase); `getMessages(locale: AppLocale)` returns readonly map; `t(locale, key, params?)` supports `{name}` interpolation for plural/simple templates; missing key falls back to EN string in dev log, EN at runtime.

#### 3. Middleware locale resolution

**File**: `src/middleware.ts`

**Intent**: Resolve locale on every request, set cookie on first detect, attach to `locals`.

**Contract**: After `getUser()`, call `resolveLocale({ user, cookies: context.cookies, acceptLanguage: context.request.headers.get("Accept-Language") })`; if no valid cookie and resolved locale came from Accept-Language, call `setLocaleCookie`; assign `context.locals.locale`.

#### 4. Locals type

**File**: `src/env.d.ts`

**Intent**: TypeScript support for `Astro.locals.locale`.

**Contract**: Add `locale: import("@/lib/locale").AppLocale` to `App.Locals`.

#### 5. Layout language attribute

**File**: `src/layouts/Layout.astro`

**Intent**: Set document language from resolved locale.

**Contract**: Read `Astro.locals.locale` (default `en` if unset during edge cases); `<html lang={locale}>`; optional `meta description` key via `t()` in later phase.

#### 6. Locale switch API

**File**: `src/pages/api/locale.ts` (new)

**Intent**: Guest topbar PL/EN toggle sets cookie and returns user to same page.

**Contract**: `GET` with query `?lang=en|pl`; validate with `isAppLocale`; `setLocaleCookie`; redirect to `Referer` path if same-origin else `/`. Export `prerender = false`.

#### 7. Signup metadata snapshot

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Freeze locale at account creation.

**Contract**: Before `signUp`, `const locale = resolveLocale(...)` from request context; `signUp({ email, password, options: { data: { locale } } })`.

#### 8. React locale context shell

**File**: `src/components/i18n/LocaleProvider.tsx`, `src/components/i18n/useLocale.ts` (new)

**Intent**: Share locale and `t()` inside React islands without prop drilling to every leaf.

**Contract**: `LocaleProvider` props `{ locale: AppLocale; children }`; context exposes `{ locale, t: (key, params?) => string }`; `useLocale()` throws outside provider.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- First visit with `Accept-Language: pl` sets cookie and `locals.locale === "pl"` (verify via temporary debug or `<html lang>`)
- `GET /api/locale?lang=en` from `/` sets cookie and redirects back with `lang="en"`
- New signup stores `user_metadata.locale` matching pre-signup cookie (Supabase dashboard or log)

---

## Phase 2: Landing selector and auth

### Overview

Guest language toggle, localized landing hero, full auth flow copy, and stable auth error keys.

### Changes Required:

#### 1. Guest locale toggle in topbar

**File**: `src/components/layout/AppTopbar.astro`

**Intent**: PL | EN segmented control visible only when `!user`; hidden for authenticated nav (roadmap non-goal).

**Contract**: Import `t` and `Astro.locals.locale`; render two links to `/api/locale?lang=pl` and `/api/locale?lang=en` with active state styling on current locale; guest nav labels (`Sign in`, `Sign up`) use `t()`.

#### 2. Landing page copy

**File**: `src/components/Welcome.astro`, `src/pages/index.astro`

**Intent**: Localize hero headline, subhead, CTAs, feature cards, and page title per `landing-copy.md` (EN) plus implementer-drafted PL.

**Contract**: All visible strings via `t(Astro.locals.locale, …)`; `<Layout title={t(...)}>` on index.

#### 3. Auth Astro pages

**File**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`

**Intent**: Localize headings, footer links, and confirm-email content branches.

**Contract**: Map `Astro.url.searchParams.get("error")` through auth error key → `t()` before passing to forms; confirm-email `content` object uses translation keys instead of inline English. Note: `confirm-email.astro` is a success-only terminal page with no form and no error display surface; the `?error=` guard requirement does not apply to it in practice.

#### 4. Auth error mapper

**File**: `src/lib/auth-errors.ts` (new)

**Intent**: Map Supabase error messages / codes to stable keys; provide localized string helper.

**Contract**: `toAuthErrorKey(error: { message?: string; code?: string }): AuthErrorKey`; `authErrorMessage(locale, key): string`; cover at minimum: invalid credentials, email taken, weak password, rate limit, unconfigured Supabase, generic fallback.

#### 5. Auth API redirects

**File**: `src/pages/api/auth/signin.ts`, `signup.ts`

**Intent**: Stop redirecting raw `error.message` in query string.

**Contract**: On failure redirect `?error=${toAuthErrorKey(error)}`; unconfigured Supabase uses key `supabase_unconfigured`.

#### 6. Auth React islands

**File**: `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`, `PasswordToggle.tsx`, `SubmitButton.tsx` (labels only if hardcoded)

**Intent**: Client-side validation messages and button pending text in user's locale.

**Contract**: Add `locale` prop; wrap in `LocaleProvider`; replace hardcoded validation strings with `t()`; pages pass `locale={Astro.locals.locale}`.

#### 7. Dev config banner

**File**: `src/lib/config-status.ts`, `src/layouts/Layout.astro`

**Intent**: Align Supabase-missing banner with app locale (user decision).

**Contract**: Replace hardcoded Polish in `configStatuses` with message keys; Layout renders `t(locale, cfg.messageKey)` and translated docs label; `<strong>` prefix localized (`common.warning` or similar).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Guest `/`: toggle PL ↔ EN reloads hero + topbar labels; `<html lang>` matches
- `/auth/signin` with `Accept-Language: pl` shows Polish without visiting landing
- Wrong password → localized error (PL and EN): no raw English Supabase text
- Signup → confirm-email page in same locale as pre-signup choice
- Authenticated topbar: **no** PL/EN toggle visible

---

## Phase 3: Dashboard, sets, review, and settings

### Overview

Translate remaining app shell and all feature React islands. Pass `locale` from Astro pages; use `LocaleProvider` at each island root.

### Changes Required:

#### 1. Authenticated topbar

**File**: `src/components/layout/AppTopbar.astro`

**Intent**: Localize Sets, Settings, Sign out for logged-in users.

**Contract**: All authenticated link labels via `t(Astro.locals.locale, …)`.

#### 2. Dashboard page and islands

**File**: `src/pages/dashboard.astro`, `src/components/dashboard/StudyHero.tsx`, `SetDashboardGrid.tsx`, `NewSetDialog.tsx`, `src/components/generator/FlashcardGenerator.tsx`

**Intent**: Localize dashboard chrome, study hero states (empty/due/caught-up with plural forms), set grid menus/dialogs, AI generator UI.

**Contract**: Astro page strings via `t()`; each island receives `locale` prop + `LocaleProvider`; PL plural rules for card/set counts (Polish plural forms: 1 / 2–4 / 5+ where needed); nested `NewSetDialog` consumes context from parent grid/hero.

#### 3. Set detail

**File**: `src/pages/sets/[id]/index.astro`, `src/components/flashcards/SetFlashcardsManager.tsx`, `src/components/flashcards/FlashcardRow.tsx`

**Intent**: Localize back link, Start review, CRUD labels, empty states, toasts.

**Contract**: Page + `SetFlashcardsManager` with `locale`; `FlashcardRow` uses `useLocale()` when rendered under manager or generator.

#### 4. Review session

**File**: `src/pages/sets/[id]/review.astro`, `src/components/srs/ReviewSession.tsx`

**Intent**: Localize session chrome, rating labels (Again/Hard/Good/Easy), loading/error/empty states; format dates with locale.

**Contract**: Pass `locale` to island; rating buttons use translation keys not `charAt(0)` capitalization; `dueDate.toLocaleString(locale, …)` (or `pl-PL` / `en-US` map).

#### 5. Settings and account deletion

**File**: `src/pages/settings.astro`, `src/components/account/AccountDangerZone.tsx`

**Intent**: Localize settings headings, stats labels, danger zone copy and dialogs.

**Contract**: Confirm field instruction localized but typed value remains `DELETE`; pluralized set/card counts in PL.

#### 6. Shared UI chrome

**File**: `src/components/ui/dialog.tsx` (optional)

**Intent**: Localize screen-reader "Close" label.

**Contract**: Either accept optional `closeLabel` prop from callers or document skip if aria-only English acceptable — prefer localized `closeLabel` from `LocaleProvider` consumer in dialogs that mount from translated islands.

#### 7. Page titles

**File**: All `src/pages/**/*.astro` in scope

**Intent**: Localized `<Layout title={…}>` for browser tab accessibility.

**Contract**: Each page passes `t(locale, 'pages.<route>.title')`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Full PL loop: `/` (PL) → sign up → dashboard → create set → add card → review → grade → settings → sign out — no English leaks in primary UI
- Full EN loop: same path with EN selector — matches current English behavior
- Dashboard due hero pluralization correct in PL for 1, 2, 5 cards
- Delete-set and delete-account dialogs readable in PL; account deletion still requires typing `DELETE`
- Review rating labels and empty state in PL

---

## Phase 4: Server error mappers and string audit

### Overview

Localize server-side error templates and API inline messages; grep audit for missed English; append bilingual regression checklist to `change.md`.

### Changes Required:

#### 1. Locale-aware lib error modules

**File**: `src/lib/account-errors.ts`, `flashcard-set-errors.ts`, `flashcard-errors.ts`, `flashcard-draft-validation.ts`, `flashcard-set-name.ts`, `openrouter-generate.ts`, `load-dashboard-sets.ts`, `load-set-detail.ts`

**Intent**: All user-visible error strings accept `locale: AppLocale` and return localized text via `t()`.

**Contract**: Each exported `*ErrorMessage(locale, error?)` signature; EN/PL keys in dictionaries; call sites updated in API routes and Astro loaders.

#### 2. API route localization

**File**: `src/pages/api/**/*.ts` (auth already done; focus flashcard-sets, flashcards, ai/generate, srs, dashboard, delete-account)

**Intent**: Resolve locale from request (cookie + Accept-Language via shared helper) and pass to error mappers for JSON `{ message }` and redirect messages.

**Contract**: Helper `getLocaleFromContext(context: APIContext): AppLocale`; no raw English string literals left in user-facing branches except invariant tokens.

#### 3. Client/server error alignment

**File**: React components with hardcoded fallback error strings (e.g. `SetDashboardGrid.tsx`, `FlashcardGenerator.tsx`, `ReviewSession.tsx`)

**Intent**: Prefer displaying server-provided localized `message`; client fallbacks use `t()` keys matching server mappers.

**Contract**: Duplicated English fallback strings replaced with shared message keys.

#### 4. String audit script / checklist

**File**: `context/changes/bilingual-ui/change.md`

**Intent**: Document audit procedure and manual regression checklist for both locales.

**Contract**: Subsection `### i18n audit (Phase 4)` with `rg` patterns for common English UI words in `src/` (excluding `i18n/en.ts`, comments, AI prompts); bilingual manual checklist mirroring S-08 regression structure.

#### 5. Dictionary completeness

**File**: `src/lib/i18n/en.ts`, `pl.ts`

**Intent**: Ensure every `MessageKey` has PL entry; implementer-drafted PL reviewed in manual QA.

**Contract**: No `t()` key without PL counterpart; brand name `10xCards` stays invariant.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Audit grep: no unexpected English string literals in scoped component files (document exceptions in `change.md`)

#### Manual Verification:

- Trigger common errors in PL: unauthorized API, rename conflict, AI generate empty text — messages appear in Polish
- Trigger same errors in EN — English messages unchanged from pre-i18n intent
- Complete bilingual checklist in `change.md`

---

## Testing Strategy

### Unit Tests:

- None in repo — not adding Vitest for this slice

### Integration Tests:

- None — manual smoke only

### Manual Testing Steps:

1. Clear cookies; visit `/` with browser PL → expect PL without clicking toggle
2. Toggle EN on landing → sign up → verify metadata.locale and UI stays EN after login
3. Sign out; clear cookies; visit `/auth/signin` with PL Accept-Language → Polish auth form
4. Wrong password PL/EN → localized banner, no provider English
5. Dashboard generator validation + API errors in both locales
6. SRS review full session PL: labels + date format
7. Settings delete dialog PL; confirm still types `DELETE`
8. Legacy user simulation: account without metadata.locale → cookie/Accept-Language fallback, no crash

## Performance Considerations

- Message dictionaries are static imports — negligible bundle impact; tree-shaking not required for ~240 strings
- Middleware adds one cookie read + optional write per first visit — no extra DB round trips
- Avoid loading both locale JSON on client: pass only active locale messages or inline `t` via serialized subset if bundle size becomes visible (unlikely at MVP scale)

## Migration Notes

- **Existing users:** No migration job; `resolveLocale` falls back cookie → Accept-Language → EN when metadata missing
- **No locale change post-login:** Do not expose `updateUser` for locale
- **Cookie persistence:** Long `maxAge` (e.g. 1 year), `path: "/"`, `sameSite: "lax"`, `httpOnly: true`

## References

- Roadmap S-09: `context/foundation/roadmap.md`
- Landing EN copy: `context/changes/study-hub-ui/landing-copy.md`
- Prerequisite UI: `context/changes/unified-paper-ui/plan.md`
- Middleware: `src/middleware.ts`
- Signup: `src/pages/api/auth/signup.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Locale infrastructure

#### Automated

- [x] 1.1 `npm run lint` passes — cf20433
- [x] 1.2 `npm run build` passes — cf20433

#### Manual

- [x] 1.3 Accept-Language and `/api/locale` cookie behavior verified — cf20433
- [x] 1.4 Signup stores `user_metadata.locale` — cf20433

### Phase 2: Landing selector and auth

#### Automated

- [x] 2.1 `npm run lint` passes — bc458d7
- [x] 2.2 `npm run build` passes — bc458d7

#### Manual

- [x] 2.3 Landing PL/EN toggle and auth flow localized — bc458d7
- [x] 2.4 Auth errors show mapped localized messages (no raw Supabase text) — bc458d7
- [x] 2.5 Authenticated topbar has no language toggle — bc458d7

### Phase 3: Dashboard, sets, review, and settings

#### Automated

- [x] 3.1 `npm run lint` passes — da48dae
- [x] 3.2 `npm run build` passes — da48dae

#### Manual

- [x] 3.3 Full PL user journey smoke (landing through settings)
- [x] 3.4 Full EN user journey smoke (parity with pre-i18n)
- [x] 3.5 PL pluralization and review labels verified

### Phase 4: Server error mappers and string audit

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm run build` passes
- [x] 4.3 String audit grep documented with exceptions

#### Manual

- [x] 4.4 Common API errors localized in PL and EN
- [x] 4.5 Bilingual regression checklist completed in `change.md`
