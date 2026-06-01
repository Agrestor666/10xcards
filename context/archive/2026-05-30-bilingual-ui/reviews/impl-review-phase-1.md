<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bilingual UI (S-09) — Phase 1

- **Plan**: context/changes/bilingual-ui/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-06-01
- **Commit**: cf20433
- **Verdict**: APPROVED (after triage)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Success Criteria Verification

| Check | Result |
|-------|--------|
| 1.1 lint | PASS — `npm run lint` exit 0 |
| 1.2 build | PASS — `npm run build` exit 0 |
| 1.3 Accept-Language / cookie | PASS — user confirmed manual OK |
| 1.4 signup metadata.locale | PASS — user confirmed manual OK |

## Findings

### F1 — Protocol-relative open redirect via Referer pathname

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/locale.ts:19-20
- **Detail**: Same-origin check passes for Referer URLs whose pathname starts with `//`.
- **Fix**: Reject pathnames starting with `//` before redirect.
- **Decision**: FIXED

### F2 — Locale cookie missing Secure flag

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/locale.ts:40-45
- **Detail**: Cookie lacked `secure` flag.
- **Fix**: Added `secure: import.meta.env.PROD`.
- **Decision**: FIXED

### F3 — t() lacks runtime missing-key fallback

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/lib/i18n/index.ts
- **Detail**: Plan contract specified EN fallback + dev log.
- **Fix**: Added `resolveText()` with EN fallback and dev warnings.
- **Decision**: FIXED

### F4 — Middleware sets cookie on any missing cookie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/middleware.ts:38-40
- **Detail**: Broader than plan wording but better for cookie/SSR alignment.
- **Fix**: No code change — accepted as intentional improvement.
- **Decision**: ACCEPTED

### F5 — GET /api/locale allows logged-in cookie overwrite

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/locale.ts
- **Detail**: Authenticated users could overwrite cookie (display locale unaffected).
- **Fix A**: Redirect logged-in users to `/dashboard` without setting cookie.
- **Decision**: FIXED (Fix A)

## Triage Summary

- **Fixed:** F1, F2, F3, F5 (4)
- **Accepted:** F4 (1)
