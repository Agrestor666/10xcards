<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account deletion (S-06)

- **Plan**: context/changes/account-deletion/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-05-29
- **Commits**: `8fbff63` … `a62f5f9` (account-deletion + dashboard sync fix `383841a`)
- **Verdict**: NEEDS ATTENTION (pre-triage) → **APPROVED** after triage (all findings fixed)
- **Findings**: 0 critical, 1 warning, 2 observations — all FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification (re-run 2026-05-29)

| Command | Result |
|---------|--------|
| `npm run lint` | PASS (exit 0) |
| `npm run build` | PASS (exit 0, ~93s) |

Manual Progress items 1.3–3.4 are all `[x]` with commit SHAs; regression checklist in `change.md` fully ticked. User confirmed manual tests passed in session.

## Findings

### F1 — Danger zone hidden when stats queries fail

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/settings.astro:55-57
- **Detail**: `AccountDangerZone` renders only when `user?.email && !statsLoadError`. If either count query fails, the user sees an error banner but cannot open account deletion — even though `POST /api/auth/delete-account` does not depend on counts. Transient DB/RLS errors block an irreversible-action path the API still supports.
- **Fix**: Always render `AccountDangerZone` when `user?.email` is set. Pass counts as numbers with fallback `0` when `statsLoadError` is set, and show inline copy such as “counts could not be loaded” in the danger zone instead of hiding it.
- **Decision**: FIXED

### F2 — signOut result ignored after successful deleteUser

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/delete-account.ts:54
- **Detail**: After successful `auth.admin.deleteUser`, `await supabase.auth.signOut()` runs but its error is not logged. User is already deleted server-side; worst case is stale cookies until next request. Matches plan’s “best-effort” intent; observability gap only.
- **Fix**: Capture `signOut` error and `console.error` server-side; still return `{ ok: true }` when delete succeeded.
- **Decision**: FIXED

### F3 — Unplanned dashboard card-count sync (Phase 3 regression)

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/dashboard-set-sync.ts; src/components/generator/FlashcardGenerator.tsx; src/components/sets/SetDashboardList.tsx
- **Detail**: During Phase 3 manual testing, user reported dashboard set card counts not updating after generator save. Fix shipped as `CustomEvent` cross-island sync (`383841a`). Not in plan; benign UX fix with no auth/service-role boundary. No security or data-integrity issue found.
- **Fix A (recommended)**: Add a one-line addendum under Phase 3 or ## Notes in `plan.md` / `change.md` documenting the dashboard sync fix and files touched.
- **Fix B**: Leave as-is (acceptable drive-by fix; no plan update).
- **Decision**: FIXED (Fix A — documented in change.md addendum)

## Plan drift summary (no separate findings)

| Item | Verdict |
|------|---------|
| All Phase 1–3 planned files | MATCH |
| `delete-account.ts` 503 when session `createClient()` null | DRIFT (benign; aligns with other auth APIs; fixed message in `881931b`) |
| `settings.astro` two parallel count queries | DRIFT (acceptable; plan allowed two queries) |
| Scope guardrails (no soft delete, export, admin panel, etc.) | MATCH |
| Prior Phase 1–2 review findings (F1 message, F2 Input) | FIXED in `881931b`, `6d7b7ed` |

## Files in implementation scope (`8fbff63^..a62f5f9`)

Planned: `astro.config.mjs`, `.env.example`, `CLAUDE.md`, `AGENTS.md`, `src/lib/supabase-admin.ts`, `src/lib/account-errors.ts`, `src/pages/api/auth/delete-account.ts`, `src/middleware.ts`, `src/pages/settings.astro`, `src/components/account/AccountDangerZone.tsx`, `src/components/Topbar.astro`, `src/components/ui/input.tsx`, `context/changes/account-deletion/change.md`, `plan.md`.

Extra: `src/lib/dashboard-set-sync.ts`, `FlashcardGenerator.tsx`, `SetDashboardList.tsx` (dashboard sync).
