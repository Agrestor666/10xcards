<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bilingual UI (S-09) — Phase 2

- **Plan**: context/changes/bilingual-ui/plan.md
- **Scope**: Phase 2 of 4
- **Date**: 2026-06-01
- **Commit**: bc458d7
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Plan Drift Summary

| # | File | Plan intent | Verdict |
|---|------|-------------|---------|
| 1 | AppTopbar.astro | Guest PL/EN toggle, localized guest nav | MATCH |
| 2 | Welcome.astro, index.astro | Localized landing + title | MATCH |
| 3 | auth/*.astro | Localized copy + error mapping | MATCH |
| 4 | auth-errors.ts | Stable keys + localized helper | MATCH (+ `resolveAuthErrorMessage` extra) |
| 5 | api/auth/signin.ts, signup.ts | Redirect with error keys | MATCH |
| 6 | SignInForm, SignUpForm, PasswordToggle | locale + LocaleProvider + t() | MATCH |
| 7 | config-status.ts, Layout.astro | Locale-aware dev banner | MATCH |

All 17 files in commit `bc458d7` align with Phase 2 "Changes Required". No unplanned files in the commit. Authenticated topbar English labels (Sets, Settings, Sign out) are correctly deferred to Phase 3.

## Success Criteria Verification

| Check | Result |
|-------|--------|
| 2.1 lint | PASS — `npm run lint` exit 0 (re-run 2026-06-01) |
| 2.2 build | PASS — `npm run build` exit 0 (re-run 2026-06-01) |
| 2.3 landing toggle + auth localized | PASS — user confirmed manual OK |
| 2.4 mapped auth errors | PASS — user confirmed manual OK |
| 2.5 no toggle when authenticated | PASS — user confirmed manual OK |

## Findings

### F1 — Locale toggle aria-label hardcoded in English

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/layout/AppTopbar.astro:53
- **Detail**: `aria-label="Language"` on the PL/EN segmented control is not passed through `t()`. Screen-reader users on PL pages hear English for the control name while surrounding copy is Polish.
- **Fix**: Add a dictionary key (e.g. `a11y.language_selector`) and render `aria-label={t(locale, "a11y.language_selector")}`.
- **Decision**: FIXED

### F2 — Polish password-length hint plural edge case (5 remaining)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/i18n/pl.ts, src/components/auth/SignUpForm.tsx:75-80
- **Detail**: Hint uses binary one/other keys. When 5 characters remain, PL copy reads *"Potrzebne jeszcze 5 znaki"* — grammatically should be *"5 znaków"*. Only affects the live length hint (not blocking validation).
- **Fix**: Add a third key for 5+ genitive plural (`auth.validation.password_chars_needed_many`) or reuse a fuller plural helper in Phase 3.
- **Decision**: FIXED
