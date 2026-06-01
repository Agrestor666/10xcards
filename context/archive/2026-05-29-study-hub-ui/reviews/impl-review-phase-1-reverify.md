<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Study hub UI (S-07) — Phase 1 (re-verification)

- **Plan**: context/changes/study-hub-ui/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-05-29
- **Prior review**: context/changes/study-hub-ui/reviews/impl-review-phase-1.md (2026-05-30)
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Prior findings — re-verification status

| ID | Original issue | Status |
|----|----------------|--------|
| F1 | Google CDN fonts instead of `@fontsource` | **FIXED** — `@fontsource` imports in `global.css`, packages in `package.json`, no Google URLs |
| F2 | `/dev/paper-preview` public in production | **FIXED** — `import.meta.env.DEV` guard returns 404 |
| F3 | Global font theme on cosmic pages | **FIXED** — `--font-sans` / `--font-serif` scoped under `.paper-theme` |

## Findings

### F1 — Instrument Serif 600 specified but unavailable

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css:4, 150-154
- **Detail**: Plan contract lists `@fontsource/instrument-serif` (400, 600). Package `@fontsource/instrument-serif@5.2.8` ships only `400.css` (no `600.css` in package). Headings use `font-weight: 600`, so the browser synthesizes bold from the 400 face. Not a regression from prior review; latent plan/package mismatch now visible after F1 font migration.
- **Fix**: Set `.paper-theme h1/h2/.font-display` to `font-weight: 400` (matches loaded face), or add a plan addendum noting Instrument Serif has no 600 weight in `@fontsource`.
- **Decision**: FIXED — heading weight set to 400; plan addendum updated (2026-05-29 triage)

### F2 — `.npmrc` mirror registry untracked

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: .npmrc:1
- **Detail**: Local `.npmrc` sets `registry=https://registry.npmmirror.com` (workaround for `ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED`). File is untracked; `package-lock.json` may resolve via mirror. Fine for one dev machine; team/CI need an explicit policy before committing lockfile + `.npmrc`.
- **Fix A ⭐ Recommended**: Document in README or plan addendum; commit `.npmrc` only if the team standardizes on the mirror for all environments.
  - Strength: Makes the SSL workaround reproducible and intentional.
  - Tradeoff: Third-party mirror trust vs default npm registry.
  - Confidence: HIGH — already documented in plan addendum 2026-05-29.
  - Blind spot: CI registry config not verified in this review.
- **Fix B**: Keep `.npmrc` local-only; ensure CI uses default `registry.npmjs.org` and lockfile stays compatible.
  - Strength: Avoids committing mirror policy.
  - Tradeoff: Local `npm install` may diverge from CI if lockfile was generated via mirror.
  - Confidence: MEDIUM — depends on whether lockfile URLs embed mirror hosts.
  - Blind spot: Haven't diffed lockfile registry URLs.
- **Decision**: FIXED (Fix A) — documented in README; `.npmrc` remains local-only (2026-05-29 triage)

### F3 — Font `@import` bundle is global

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/styles/global.css:1-4
- **Detail**: `@fontsource` CSS is imported at the top of `global.css` (loaded via `Layout.astro` on every route). F3 fixed *application* (families under `.paper-theme`); cosmic pages still download font assets. Acceptable for MVP.
- **Fix**: Defer — route-scoped font loading is a follow-up optimization, not Phase 1 blocker.
- **Decision**: FIXED — fonts moved to `paper-fonts.css` imported by `PaperShell.astro` only (2026-05-29 triage)

## Plan drift matrix (Phase 1)

| Planned item | Verdict |
|--------------|---------|
| Paper CSS tokens + `bg-paper` | MATCH |
| `@fontsource` in package.json + global.css | MATCH |
| `PaperShell.astro` | MATCH |
| `AppTopbar.astro` | MATCH |
| `Layout.astro` default title `"10xCards"` | MATCH |
| Old `Topbar` unchanged on cosmic routes | MATCH |
| Manual preview route (DEV-guarded) | MATCH |
| Instrument Serif 600 import | N/A — package has no 600 weight file |

## Success criteria verification

| Check | Result |
|-------|--------|
| `npm run lint` | PASS (2026-05-29 re-run) |
| `npm run build` | PASS (2026-05-29 re-run) |
| Progress 1.1–1.3 | `[x]` — automated + manual confirmed in Progress |

## Commits in scope

- `03517ad` — feat(study-hub-ui): Paper theme foundation (p1)
- `67e8741` — chore(study-hub-ui): address Phase 1 review findings
- Font migration + `.npmrc` (working tree, post Phase 1 review)
