# CI Quality Gate Implementation Plan

## Overview

Add `npm test` to the existing GitHub Actions `ci` job so failing tests block PR merges and pushes to `master` — the same gate pattern as lint and build. This is test-plan Phase 5: the enforcement layer once earlier rollout phases have bootstrapped Vitest and a meaningful suite.

## Current State Analysis

- **CI** (`.github/workflows/ci.yml`): `npm ci` → `npx astro sync` → `npm run lint` → `npm run build` (with `SUPABASE_URL` / `SUPABASE_KEY`). The `deploy` job `needs: ci` — anything that fails the `ci` job already blocks production deploy.
- **Tests**: No Vitest config, no `test` script in `package.json`, zero `*.test.ts` / `*.spec.ts` files. Test-plan Phase 1 (`testing-bootstrap-srs-scheduling`) is marked "change opened" but has not landed.
- **Docs**: `AGENTS.md` and `CLAUDE.md` CI sections describe lint + build only.
- **Health-check** (`context/foundation/health-check.md`): Already recommends adding `- run: npm test` after Vitest bootstrap.

## Desired End State

After this change merges (and Phase 1 prerequisite is satisfied):

1. Every push and PR to `master` runs `npm test` in CI between lint and build.
2. A failing test fails the `ci` job, blocking merge and (via `needs: ci`) blocking auto-deploy.
3. `AGENTS.md`, `CLAUDE.md`, and `context/foundation/test-plan.md` reflect the three-stage CI gate: lint → test → build.
4. Local verification: `npm run lint && npm test && npm run build` matches CI order.

### Key Discoveries:

- `.github/workflows/ci.yml:20-24` — lint and build steps; test inserts after lint, before build.
- `package.json:5-12` — no `test` script yet; this plan does **not** add Vitest (Phase 1 scope).
- `context/foundation/test-plan.md:73` — Phase 5 goal is explicit: "`npm test` blocks merge alongside lint + build".
- Deploy pipeline already gates on `ci` job success — no deploy-job changes needed.

## What We're NOT Doing

- Bootstrapping Vitest, adding test files, or creating the `npm test` script (Phase 1: `testing-bootstrap-srs-scheduling`).
- Pre-wiring Supabase secrets into the test step (integration tests in Phases 2–4 add env needs later).
- Local Supabase service containers or Docker-based test infra in CI.
- Branch protection rule changes in GitHub repo settings (not committable; optional operator note in `change.md`).
- `continue-on-error` soft gate — tests must block merge from day one this lands.
- Changes to the `deploy` job (already `needs: ci`).

## Implementation Approach

Single surgical edit to `.github/workflows/ci.yml`: insert `- run: npm test` after lint, before build. No env block on the test step. Sync agent-facing docs and test-plan orchestrator status. Treat Phase 1 as a **hard merge prerequisite** — implement this change only after `testing-bootstrap-srs-scheduling` has merged with a working `npm test` script.

## Critical Implementation Details

**Hard prerequisite:** Do not merge this change until Phase 1 (`testing-bootstrap-srs-scheduling`) has landed with `"test": "vitest run"` (or equivalent) in `package.json` and at least one passing test. Merging the CI step before that will fail every CI run with "Missing script: test".

**Step order:** `lint` → `test` → `build`. Unit tests fail fast without paying for an Astro SSR build. Vitest does not require build output.

## Phase 1: Wire test step in CI

### Overview

Add `npm test` to the existing `ci` job so test failures block the pipeline.

### Changes Required:

#### 1. Test step in CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Enforce the test suite on every PR and push to `master`, matching lint/build gate behavior.

**Contract**:
- In the `ci` job, after `- run: npm run lint` and before `- run: npm run build`, add `- run: npm test`.
- No `env:` block on the test step (Phase 1 SRS unit tests run without Supabase; integration env vars added in a future change when needed).
- Do not modify the `deploy` job — it already `needs: ci`.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid (no syntax errors)
- Lint passes locally: `npm run lint`
- Tests pass locally: `npm test` (requires Phase 1 prerequisite)
- Build passes locally: `npm run build` (with `SUPABASE_URL` and `SUPABASE_KEY` set)

#### Manual Verification:

- Open a PR with a deliberately failing test — `ci` job fails on the test step
- Confirm `deploy` job is skipped when `ci` fails on a push to `master`
- Revert the failing test — full `ci` job passes (lint → test → build)

**Implementation Note**: Verify Phase 1 is merged and `npm test` passes locally before opening the PR for this change.

---

## Phase 2: Sync docs and test-plan status

### Overview

Update agent onboarding docs and the test-plan orchestrator so CI expectations stay accurate.

### Changes Required:

#### 1. AGENTS.md CI Gate section

**File**: `AGENTS.md`

**Intent**: Agents know tests block merge alongside lint and build.

**Contract**: Update the `## CI Gate` paragraph to describe `lint` + `test` + `build` on push/PR to `master`. Note that `npm test` runs Vitest (`vitest run`). Keep deploy paragraph unchanged.

#### 2. CLAUDE.md CI section

**File**: `CLAUDE.md`

**Intent**: Same CI gate update for Claude-oriented agent rules.

**Contract**: Update the `## CI` section to list lint + test + build. Add `npm test` to the Commands section if not already present.

#### 3. Test-plan Phase 5 status

**File**: `context/foundation/test-plan.md`

**Intent**: Keep the test-rollout orchestrator in sync with this change folder.

**Contract**:
- Phase 5 row: set `Change folder` to `ci-quality-gate`.
- Update `Status` to reflect rollout progress when implementation completes (orchestrator literal: `planned` after this plan lands; `complete` after `/10x-implement` finishes).

#### 4. Change notes — prerequisite reminder

**File**: `context/changes/ci-quality-gate/change.md` (## Notes)

**Intent**: Future readers know merge ordering.

**Contract**: Append a short note that Phase 1 (`testing-bootstrap-srs-scheduling`) must merge before this change; list the CI step order lint → test → build.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`

#### Manual Verification:

- `AGENTS.md` and `CLAUDE.md` CI descriptions match `.github/workflows/ci.yml` step order
- Test-plan Phase 5 row references `ci-quality-gate`

---

## Testing Strategy

### Unit Tests:

- Not in scope for this change — Phase 1 delivers the suite that CI will run.

### Integration Tests:

- Not in scope — Phases 2–4 add integration tests; env-var CI wiring deferred until those tests exist.

### Manual Testing Steps:

1. Confirm Phase 1 merged: `npm test` exits 0 locally.
2. Merge CI change; open a PR — Actions log shows lint → test → build in order.
3. Introduce a failing assertion in any test file; push — CI fails on test step, deploy skipped on master.
4. Revert failure — CI green end-to-end.

## Performance Considerations

Vitest unit tests add seconds, not minutes, to CI. Placing tests before build avoids wasting build time on test failures. No parallel jobs needed at current suite size.

## Migration Notes

No data migration. Rollback: remove the `- run: npm test` line from `ci.yml` and revert doc updates. Tests remain runnable locally via `npm test`.

## References

- Test plan Phase 5: `context/foundation/test-plan.md` §3
- Health-check recommendation: `context/foundation/health-check.md` (Vitest + CI test step)
- Prior CI pattern: `context/archive/2026-06-08-deploy-pipeline/plan.md`
- Prerequisite change: `testing-bootstrap-srs-scheduling` (Phase 1 — not yet in repo)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Wire test step in CI

#### Automated

- [x] 1.1 Workflow YAML is valid (no syntax errors) — 6d12801
- [x] 1.2 Lint passes locally: `npm run lint` — 6d12801
- [x] 1.3 Tests pass locally: `npm test` (requires Phase 1 prerequisite) — 6d12801
- [x] 1.4 Build passes locally: `npm run build` (with Supabase env vars set) — 6d12801

#### Manual

- [x] 1.5 Open a PR with a deliberately failing test — `ci` job fails on the test step — 6d12801
- [x] 1.6 Confirm `deploy` job is skipped when `ci` fails on a push to `master` — 6d12801
- [x] 1.7 Revert the failing test — full `ci` job passes (lint → test → build) — 6d12801

### Phase 2: Sync docs and test-plan status

#### Automated

- [x] 2.1 Lint passes: `npm run lint`

#### Manual

- [x] 2.2 `AGENTS.md` and `CLAUDE.md` CI descriptions match `.github/workflows/ci.yml` step order
- [x] 2.3 Test-plan Phase 5 row references `ci-quality-gate`
