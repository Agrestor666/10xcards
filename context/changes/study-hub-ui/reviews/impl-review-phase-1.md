<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Study hub UI (S-07) — Phase 1

- **Plan**: context/changes/study-hub-ui/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-05-30
- **Commits**: `03517ad`, `a072844`
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Fonts use Google CDN instead of @fontsource

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css:1, package.json (missing deps)
- **Detail**: Plan contract requires `@fontsource/dm-sans` and `@fontsource/instrument-serif` in `package.json` with imports in `global.css` for SSR-safe self-hosted fonts. Implementation uses a Google Fonts `@import` URL at the top of `global.css`; no font packages in `package.json`. Documented reason: local `npm install` failed with `ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED`. Typography and token behavior otherwise match intent.
- **Fix A ⭐ Recommended**: When npm install works, add `@fontsource/*` packages, replace the Google `@import` with fontsource CSS imports, and drop the external request.
  - Strength: Matches plan, better privacy/offline/SSR consistency, no third-party font host at runtime.
  - Tradeoff: Requires fixing local npm/SSL or doing the swap in CI and committing lockfile.
  - Confidence: HIGH — straightforward swap; imports already structured at top of global.css.
  - Blind spot: CI lockfile not verified in this review for font packages.
- **Fix B**: Document the CDN deviation as a plan addendum and keep Google Fonts until MVP ships.
  - Strength: No blocked work; fonts already render correctly.
  - Tradeoff: External dependency and GDPR/privacy consideration for EU users.
  - Confidence: MEDIUM — acceptable for MVP if documented.
  - Blind spot: Whether Cloudflare Workers block outbound font fetches (they don't — CSS @import is client-side).
- **Decision**: ACCEPTED (Fix B) — keep Google Fonts CDN until MVP; plan addendum added 2026-05-30

### F2 — `/dev/paper-preview` ships in production builds

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/dev/paper-preview.astro
- **Detail**: Preview route is public (not under `PROTECTED_ROUTES`). File comment says "Remove or restrict before production if undesired." Plan allowed a throwaway test route for Phase 1 manual verification — acceptable now; consider removal or `import.meta.env.DEV` guard before wide deploy.
- **Fix**: Delete the route in Phase 4 regression, or wrap page in `if (import.meta.env.DEV)` and return 404 in production.
- **Decision**: FIXED — `import.meta.env.DEV` guard returns 404 in production (2026-05-30 triage)

### F3 — Global font theme affects non-paper pages

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/styles/global.css:76-78
- **Detail**: `@theme inline` sets `--font-sans` and `--font-serif` globally, so cosmic pages (`settings`, `review`) will also load DM Sans/Instrument Serif once fonts resolve. Harmless visually; only matters if cosmic pages should keep system fonts until Phase 3+.
- **Fix**: Scope `--font-sans`/`--font-serif` overrides under `.paper-theme` only if cosmic pages should stay unchanged.
- **Decision**: FIXED — font CSS variables moved from `@theme inline` to `.paper-theme` (2026-05-30 triage)

## Plan drift matrix (Phase 1)

| Planned item | Verdict |
|--------------|---------|
| Paper CSS tokens + `bg-paper` | MATCH |
| `@fontsource` in package.json | DRIFT (Google CDN) |
| `PaperShell.astro` | MATCH |
| `AppTopbar.astro` | MATCH |
| `Layout.astro` default title | MATCH |
| Old `Topbar` unchanged on cosmic routes | MATCH (not modified) |
| Manual preview route | MATCH (`/dev/paper-preview`) |

## Success criteria verification

| Check | Result |
|-------|--------|
| `npm run lint` | PASS (re-run 2026-05-30) |
| `npm run build` | PASS (re-run 2026-05-30) |
| Progress 1.3 manual | `[x]` — user confirmed |
