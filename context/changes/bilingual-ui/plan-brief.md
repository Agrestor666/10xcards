# Bilingual UI (S-09) — Plan Brief

> Full plan: `context/changes/bilingual-ui/plan.md`  
> Roadmap: `context/foundation/roadmap.md` (S-09)  
> Prerequisites: S-07 (`study-hub-ui`), S-08 (`unified-paper-ui`, `impl_reviewed`)

## What & Why

Polish learners are a primary audience, but the app is English-only today. S-09 adds **PL and EN** for the full UI: guests choose language on the landing topbar (or get a browser default), and that choice **locks at signup** — no post-login switch. This matches the product goal of serving the Polish market without building full i18n infrastructure for many languages.

## Starting Point

- **No i18n:** ~210–240 hardcoded English strings across 14 routes and 8 React islands; `<html lang="en">`; middleware handles auth only.
- **Persistence gap:** Signup does not set `user_metadata`; no app locale cookie.
- **EN copy spec:** `landing-copy.md` for hero; dev Supabase banner is oddly hardcoded Polish in `config-status.ts`.
- **UI ready:** S-08 paper theme on all user routes — translate once on stable shells.

## Desired End State

- Guest sees **PL | EN** in landing `AppTopbar`; `Accept-Language` fills in when no choice yet.
- After signup, `user_metadata.locale` + cookie keep SSR and islands consistent; authenticated UI has **no** language toggle.
- Landing, auth, dashboard, sets, review, settings, and common API errors render in the chosen language.
- Manual PL + EN smoke checklists pass; lint and build green.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Locale persistence | Cookie + `user_metadata` at signup | Survives cookie loss; frozen after login | Plan |
| i18n mechanism | Typed dictionaries + `t()` (no library) | Two locales, Astro SSR-first, minimal deps | Plan |
| Server errors | UI + `lib/*-errors` + common API messages | Polish users see localized banners, not English JSON | Plan |
| Landing selector | PL \| EN toggle in guest `AppTopbar` | Visible, consistent with nav; hidden when logged in | Plan |
| PL copy | Implementer drafts; user reviews in QA | Unblocks work; polish pass before release | Plan |
| Supabase auth errors | Map known errors to keys; generic fallback | Localized sign-in/up without raw provider text | Plan |
| Delete confirm token | Invariant `DELETE` | Safety; matches account-deletion plan | Plan |
| Dev config banner | Align with app locale | One system; no PL banner on EN page | Plan |
| Legacy accounts | Fallback chain; no metadata backfill | No migration; cookie/browser default until re-register | Plan |

## Scope

**In scope:**
- Locales: `en`, `pl` only
- Middleware resolution, cookie, signup snapshot, `/api/locale` toggle
- All user routes + React islands + lib error mappers
- Auth error key mapping; localized dev banner

**Out of scope:**
- Post-login language change; 3+ locales; AI card content translation
- Error-code API refactor; DB migrations; automated tests
- Metadata backfill for existing users; localized `DELETE` token

## Architecture / Approach

```
Accept-Language / cookie / user_metadata.locale
        ↓
middleware → Astro.locals.locale
        ↓
Astro: t(locale, key)     React: locale prop → LocaleProvider → useLocale()
        ↓
signup options.data.locale (snapshot)
        ↓
API routes: getLocaleFromContext → localized *ErrorMessage(locale)
```

Guest toggle: links to `GET /api/locale?lang=pl|en` → set cookie → redirect back.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Locale infrastructure | middleware, cookie, `t()`, signup snapshot, Layout `lang` | Cookie/httpOnly + SSR mismatch if read client-side |
| 2. Landing + auth | Topbar toggle, Welcome, auth forms, error keys | Missing Supabase error mapping edge cases |
| 3. App surfaces | Dashboard, sets, review, settings islands | Missed strings; PL plural forms |
| 4. Server errors + audit | Localized API/lib errors, grep checklist | Client/server duplicate fallbacks drift |

**Prerequisites:** S-08 complete (`unified-paper-ui` `impl_reviewed`).

**Estimated effort:** ~3–4 focused sessions across 4 phases.

## Open Risks & Assumptions

- ~240 strings is tedious — Phase 4 audit is essential to catch EN leaks.
- Implementer-drafted PL may need copy review before production release.
- Supabase error message text can vary by version — maintain small mapping table with generic fallback.
- No Vitest — regression is manual per phase.

## Success Criteria (Summary)

- Guest can use app entirely in PL or EN from first visit through account deletion UI.
- Language cannot be changed after login; no toggle in settings/topbar.
- Lint + build pass; bilingual checklist in `change.md` completed.
