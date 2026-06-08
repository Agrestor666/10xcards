# Deploy pipeline (F-02) Implementation Plan

## Overview

Add automatic production deployment to Cloudflare Workers on every merge to `master`. PRs keep the existing lint+build gate; only pushes to `master` trigger rebuild, `wrangler deploy`, and an HTTP smoke check against the production URL.

## Current State Analysis

- **CI** (`.github/workflows/ci.yml`) runs `npm ci` → `astro sync` → `lint` → `build` on push and PR to `master`. No deploy step.
- **Wrangler** (`wrangler.jsonc`) targets Worker `10xcards` with `account_id`, KV `SESSION` binding, and static assets from `./dist`. Observability enabled.
- **Build secrets** in GitHub: `SUPABASE_URL`, `SUPABASE_KEY` (injected at build time per `astro.config.mjs` env schema).
- **Runtime secrets** (Wrangler, not CI): `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY` — set via `wrangler secret put` (documented in account-deletion change; not in CI).
- **Deploy today** is manual: `npm run build` → `npx wrangler deploy` (README, CLAUDE.md).
- **No** `CLOUDFLARE_API_TOKEN`, `PRODUCTION_URL` GitHub config, or `npm run deploy` script.
- **Landing `/`** is public (not in `PROTECTED_ROUTES` in `src/middleware.ts`) — suitable for HTTP 200 smoke check for unauthenticated guests.

## Desired End State

After merging any PR to `master`:

1. CI lint+build passes on the merge commit.
2. A `deploy` job rebuilds and runs `wrangler deploy` to the `10xcards` Worker.
3. CI curls `PRODUCTION_URL/` and fails if HTTP status is not 200.
4. Operators have a documented one-time setup for `CLOUDFLARE_API_TOKEN`, `PRODUCTION_URL`, and Wrangler runtime secrets.

Verification: merge a trivial doc-only change to `master` and confirm the Worker updates without manual `wrangler deploy`; smoke step passes; app loads at production URL.

### Key Discoveries:

- Roadmap F-02 scopes to merge-to-master only — PR preview deploys explicitly out of scope.
- `account_id` is already in `wrangler.jsonc` — deploy job does not need `CLOUDFLARE_ACCOUNT_ID` unless token scope requires it.
- CI build does not need `SUPABASE_SERVICE_ROLE_KEY` or `OPENROUTER_API_KEY`; production Worker must have all four runtime secrets or features break silently (account deletion → 503; AI generation → error).

## What We're NOT Doing

- PR / branch preview deployments (`wrangler versions upload` preview flow).
- Syncing runtime secrets from GitHub Actions into Wrangler on every deploy.
- Custom domain or DNS changes.
- Application code changes.
- Supabase migration automation in CI.
- Sentry / application-level observability (parked in roadmap).

## Implementation Approach

- Extend `.github/workflows/ci.yml` with a `deploy` job (`needs: ci`, `if: push to master`).
- Rebuild in the deploy job (duplicate of CI build steps) then `cloudflare/wrangler-action@v4` with `command: deploy`.
- Add HTTP smoke check using `vars.PRODUCTION_URL` after deploy.
- Document one-time operator setup in `change.md` ## Notes and update README + CLAUDE.md.

## Critical Implementation Details

**Branch name is `master`, not `main`.** The deploy `if:` guard and any docs must reference `refs/heads/master` to match the existing workflow trigger.

**Smoke check target:** Use `GET /` (public landing). Do not use `/dashboard` (redirects unauthenticated users to sign-in). Follow redirects with `curl -L` only if needed; unauthenticated `/` should return 200 directly.

## Phase 1: Deploy job in CI

### Overview

Add a production deploy job to the existing CI workflow that runs only after a successful lint+build on pushes to `master`.

### Changes Required:

#### 1. Deploy job in CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Gate production deploys on the same commit that passed lint+build; skip deploy on pull requests.

**Contract**:
- Keep existing `ci` job unchanged (runs on `push` + `pull_request` to `master`).
- Add job `deploy`:
  - `needs: ci`
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/master'`
  - `runs-on: ubuntu-latest`
  - Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node 22, npm cache), `npm ci`, `npx astro sync`, `npm run build` with `SUPABASE_URL` / `SUPABASE_KEY` from `secrets`, then `cloudflare/wrangler-action@v4` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}` and `command: deploy`
- Do not pass runtime secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`) to the build step unless already required — they remain Wrangler-only.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid (no syntax errors; GitHub Actions schema accepts the file)
- Lint passes locally: `npm run lint`
- Build passes locally: `npm run build` (with env vars set)

#### Manual Verification:

- `CLOUDFLARE_API_TOKEN` secret is configured in GitHub repo settings with Workers Scripts Edit permission
- After merging to `master`, deploy job appears in Actions and completes successfully
- `wrangler deployments list` (or Cloudflare dashboard) shows a new deployment for `10xcards`

**Implementation Note**: After automated checks pass, configure `CLOUDFLARE_API_TOKEN` and merge a test commit to `master` to confirm the deploy job runs end-to-end before Phase 2 smoke wiring.

---

## Phase 2: Post-deploy HTTP smoke check

### Overview

Fail the pipeline if production does not return HTTP 200 on the public landing page immediately after deploy.

### Changes Required:

#### 1. Smoke check step in deploy job

**File**: `.github/workflows/ci.yml` (append to `deploy` job, after wrangler-action step)

**Intent**: Catch catastrophic deploy failures (Worker not serving, wrong URL, boot error) automatically.

**Contract**:
- Add step after deploy: curl `${{ vars.PRODUCTION_URL }}/` with `--fail`, reasonable `--retry` (e.g. 3) and `--retry-delay` (e.g. 5s) to allow propagation
- Assert exit code 0 (curl `--fail` treats non-2xx as failure)
- `PRODUCTION_URL` is a **repository variable** (not secret) — e.g. `https://10xcards.<account-subdomain>.workers.dev` with no trailing slash

#### 2. Document PRODUCTION_URL variable

**File**: `context/changes/deploy-pipeline/change.md` (## Notes — operator setup section from Phase 3 can reference this)

**Intent**: Operator knows which GitHub variable to set before first smoke-enabled deploy.

**Contract**: Note that `vars.PRODUCTION_URL` must match the live Worker URL (workers.dev default or custom domain if added later).

### Success Criteria:

#### Automated Verification:

- Workflow YAML remains valid after smoke step addition

#### Manual Verification:

- `PRODUCTION_URL` repository variable is set in GitHub
- Deploy job smoke step passes on a successful merge to `master`
- Intentionally wrong `PRODUCTION_URL` causes smoke step to fail (verify once, then fix)

**Implementation Note**: Confirm smoke passes on first real deploy before Phase 3 doc pass.

---

## Phase 3: Operator runbook and documentation

### Overview

Document one-time production setup and align README/CLAUDE.md with auto-deploy reality.

### Changes Required:

#### 1. Operator setup in change notes

**File**: `context/changes/deploy-pipeline/change.md` (## Notes)

**Intent**: Single runbook for first-time production deploy and secret rotation.

**Contract** — document these one-time steps:

**GitHub (repo settings):**
- Secret `CLOUDFLARE_API_TOKEN` — API token with **Workers Scripts → Edit** (minimum); create at Cloudflare dashboard → My Profile → API Tokens
- Variable `PRODUCTION_URL` — full HTTPS origin, no trailing slash (default: `https://10xcards.<subdomain>.workers.dev`)
- Secrets `SUPABASE_URL`, `SUPABASE_KEY` — already required for CI build

**Cloudflare Worker runtime secrets** (one-time per Worker, via `npx wrangler secret put <NAME>`):
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for account deletion)
- `OPENROUTER_API_KEY` (required for AI generation)

Note: CI build does not need service role or OpenRouter keys; production Worker must have them.

**Rollback:** `npx wrangler rollback` for bad Worker deploys; DB migrations do not roll back with Worker rollback.

#### 2. README deployment section

**File**: `README.md` (## Deployment and ## CI sections)

**Intent**: Replace manual-only deploy instructions with auto-deploy primary path; keep manual deploy as fallback.

**Contract**:
- CI section: lint + build on PR/push; **auto-deploy on push to `master`** after CI passes
- Deployment section: list GitHub + Wrangler one-time setup; note `npm run build && npx wrangler deploy` for emergency manual deploy
- Reference operator checklist in `context/changes/deploy-pipeline/change.md`

#### 3. CLAUDE.md deploy note

**File**: `CLAUDE.md` (Environment / Deploy bullets)

**Intent**: Agents know deploy is automated and where secrets live.

**Contract**: Update deploy line to mention GitHub Actions auto-deploy on `master`; runtime secrets via `wrangler secret put`; link pattern matches existing doc style.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- New contributor can follow `change.md` notes to configure GitHub secrets/vars and Wrangler secrets without asking
- README and CLAUDE.md accurately describe CI vs manual deploy
- Production smoke check still passes after doc-only merge

---

## Testing Strategy

### Unit Tests:

- Not applicable — no application code changes; no test runner in repo.

### Integration Tests:

- GitHub Actions workflow is the integration test surface.

### Manual Testing Steps:

1. Configure `CLOUDFLARE_API_TOKEN` and `PRODUCTION_URL` in GitHub.
2. Confirm all four Wrangler runtime secrets are set on `10xcards` Worker.
3. Merge a trivial change to `master`; verify `ci` then `deploy` jobs succeed.
4. Visit `PRODUCTION_URL` — landing loads; sign-in works; AI generate and account deletion paths work (confirms runtime secrets).
5. Open a PR — verify only `ci` runs, no `deploy` job.

## Performance Considerations

Duplicate build on merge (~1–2 min) is acceptable at current scale. No change to Worker runtime behavior.

## Migration Notes

No data migration. First auto-deploy ships the same artifact as manual deploy would. Ensure Wrangler runtime secrets exist **before** first auto-deploy merge that enables smoke check, or smoke may pass while features fail at runtime.

## References

- Roadmap F-02: `context/foundation/roadmap.md` (lines 90–101)
- Infrastructure ops: `context/foundation/infrastructure.md` (Operational Story)
- Runtime secrets precedent: `context/changes/account-deletion/change.md`
- CI baseline: `.github/workflows/ci.yml`
- Wrangler config: `wrangler.jsonc`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Deploy job in CI

#### Automated

- [x] 1.1 Workflow YAML is valid (no syntax errors; GitHub Actions schema accepts the file)
- [x] 1.2 Lint passes locally: `npm run lint`
- [x] 1.3 Build passes locally: `npm run build` (with env vars set)

#### Manual

- [ ] 1.4 `CLOUDFLARE_API_TOKEN` secret configured with Workers Scripts Edit permission
- [ ] 1.5 After merging to `master`, deploy job completes successfully
- [ ] 1.6 Cloudflare dashboard shows new deployment for `10xcards`

### Phase 2: Post-deploy HTTP smoke check

#### Automated

- [ ] 2.1 Workflow YAML remains valid after smoke step addition

#### Manual

- [ ] 2.2 `PRODUCTION_URL` repository variable set in GitHub
- [ ] 2.3 Deploy job smoke step passes on successful merge to `master`
- [ ] 2.4 Wrong `PRODUCTION_URL` fails smoke step (verified once, then corrected)

### Phase 3: Operator runbook and documentation

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Operator runbook in `change.md` covers GitHub secrets/vars and Wrangler secrets
- [ ] 3.4 README and CLAUDE.md describe auto-deploy on `master`
- [ ] 3.5 Production smoke check passes after doc-only merge
