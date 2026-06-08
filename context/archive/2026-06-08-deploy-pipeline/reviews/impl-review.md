<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Deploy pipeline (F-02)

- **Plan**: context/changes/deploy-pipeline/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-08
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 4 warnings, 2 observations — all triaged

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — AGENTS.md still describes manual-only deploy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md:39-45
- **Detail**: `README.md` and `CLAUDE.md` were updated for auto-deploy on `master`, smoke check, and operator runbook link. `AGENTS.md` CI Gate and Deployment sections still say lint+build only and `npx wrangler deploy` manual path. Agents reading AGENTS.md first get stale guidance.
- **Fix**: Update `AGENTS.md` CI Gate and Deployment sections to mirror README/CLAUDE (auto-deploy on `master`, link to `context/changes/deploy-pipeline/change.md`).
- **Decision**: FIXED

### F2 — PRODUCTION_URL expanded in shell double quotes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:47
- **Detail**: Smoke step uses `run: curl … "${{ vars.PRODUCTION_URL }}/"`. GitHub expands the expression before bash runs; a malicious or malformed variable value containing `"`, backticks, or `$(…)` could break out of quoting. Risk is limited to repo admins with variable write access, but the pattern is avoidable.
- **Fix A ⭐ Recommended**: Move URL to step `env` and curl `"$PRODUCTION_URL/"` — GitHub passes env values without shell metacharacter interpretation in the `run` script when referenced as `"$PRODUCTION_URL"`.
  - Strength: Standard GHA hardening; one-line structural change.
  - Tradeoff: Minimal; slightly more YAML.
  - Confidence: HIGH — common pattern in workflow hardening guides.
  - Blind spot: None significant.
- **Fix B**: Add a validation step rejecting values not matching `^https://[a-zA-Z0-9.-]+$`
  - Strength: Fails fast on typos as well as injection.
  - Tradeoff: Rejects valid URLs with paths or ports if ever needed.
  - Confidence: MEDIUM — current contract is origin-only, no trailing slash.
  - Blind spot: Custom domains with unusual characters.
- **Decision**: FIXED (Fix A)

### F3 — Unset PRODUCTION_URL fails opaquely

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:47
- **Detail**: If `PRODUCTION_URL` is unset, the step becomes `curl … "/"` — same failure mode observed during implementation when the variable was set in an Environment instead of repository Variables. Error message (`No host part in the URL`) does not name the missing config.
- **Fix**: Add `if: vars.PRODUCTION_URL != ''` on the smoke step, or a prior step that exits 1 with `::error::PRODUCTION_URL repository variable is not set`.
- **Decision**: FIXED

### F4 — No deploy job concurrency guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:26-47
- **Detail**: Rapid successive merges to `master` can run overlapping `deploy` jobs. Cloudflare last-writer-wins; smoke on job A may pass while job B is still deploying, or an older deploy may finish after a newer one.
- **Fix**: Add `concurrency: group: production-deploy, cancel-in-progress: false` on the `deploy` job.
  - Strength: Serializes production deploys; matches common CD practice.
  - Tradeoff: Queued deploys wait; `cancel-in-progress: false` avoids aborting an in-flight deploy.
  - Confidence: HIGH — low-traffic project still benefits on double-merge.
  - Blind spot: None significant.
- **Decision**: FIXED

### F5 — Smoke check has no curl timeouts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:47
- **Detail**: No `--connect-timeout` or `--max-time`. A hung origin blocks the job until runner limits.
- **Fix**: Add `--connect-timeout 10 --max-time 30` to the curl command.
- **Decision**: FIXED

### F6 — Shallow smoke check by design

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: .github/workflows/ci.yml:46-47
- **Detail**: `GET /` only verifies Worker boot and public routing. Missing Wrangler runtime secrets or broken API paths still pass deploy+smoke — already documented in `change.md` L47. Matches F-02 MVP scope; not a drift from plan.
- **Fix**: Extended smoke to curl `/` and `/auth/signin` (public SSR pages; still does not verify runtime secrets without a dedicated health endpoint).
- **Decision**: FIXED
