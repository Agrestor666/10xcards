# CI Quality Gate — Plan Brief

> Full plan: `context/changes/ci-quality-gate/plan.md`
> Research: `context/foundation/test-plan.md` (Phase 5)

## What & Why

Test-plan Phase 5 closes the loop: once Vitest and a meaningful suite exist (Phases 1–4), CI must run `npm test` on every PR and push to `master` so regressions cannot merge. Today CI only lint+builds; tests are optional at best because no runner exists yet.

## Starting Point

`.github/workflows/ci.yml` runs `npm ci` → `astro sync` → `lint` → `build`. The `deploy` job already `needs: ci`. `package.json` has no `test` script; zero test files. Phase 1 (`testing-bootstrap-srs-scheduling`) is planned but not merged.

## Desired End State

Every PR/push to `master` runs lint → **test** → build. Failing tests block merge and auto-deploy. `AGENTS.md`, `CLAUDE.md`, and test-plan Phase 5 reflect the three-stage gate. Local dev mirrors CI: `npm run lint && npm test && npm run build`.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Phase 1 dependency | Hard prerequisite | Clean separation per test-plan sequencing; no duplicate Vitest bootstrap | Plan |
| Step order | lint → test → build | Fail fast before expensive Astro build; matches health-check guidance | Plan |
| Test env vars | None for now | Phase 1 SRS tests need no Supabase; add secrets when integration tests land | Plan |
| Deploy job | No changes | `needs: ci` already gates deploy on test failures | Research |
| Docs scope | CI + AGENTS.md + CLAUDE.md + test-plan | Keep agent onboarding and orchestrator accurate | Plan |
| Soft gate | Rejected | `continue-on-error` undermines merge-blocking purpose | Plan |

## Scope

**In scope:**
- `- run: npm test` in `.github/workflows/ci.yml` (after lint, before build)
- `AGENTS.md` and `CLAUDE.md` CI section updates
- Test-plan Phase 5 status/folder sync

**Out of scope:**
- Vitest bootstrap, test files, `npm test` script (Phase 1)
- Supabase secrets in test step (future integration phases)
- Branch protection repo settings, deploy job changes

## Architecture / Approach

```
PR or push → master
  └─ ci job: npm ci → astro sync → lint → test → build
  └─ deploy job (push to master only, needs ci): unchanged
```

No new GitHub secrets. Test step has no `env:` block until later phases need it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Wire test step in CI | `npm test` in `ci` job between lint and build | Merging before Phase 1 → every CI run fails ("Missing script: test") |
| 2. Sync docs and test-plan | AGENTS.md, CLAUDE.md, test-plan Phase 5 row | Docs drift if only ci.yml is updated |

**Prerequisites:** Phase 1 (`testing-bootstrap-srs-scheduling`) merged with working `npm test` and at least one passing test.

**Estimated effort:** ~1 focused session across 2 phases.

## Open Risks & Assumptions

- Phase 1 must merge first — this change is inert or red without it.
- Later integration tests (Phases 2–4) will require a follow-up CI change to inject env vars.
- Green CI does not replace branch protection — repo admins may still want to require the CI check in GitHub settings.

## Success Criteria (Summary)

- Failing tests block PR merge and master deploy.
- CI log shows lint → test → build in order.
- Agent docs and test-plan describe the three-stage gate accurately.
