---
change_id: deploy-pipeline
title: Deploy pipeline
status: archived
created: 2026-06-08
updated: 2026-06-08
archived_at: 2026-06-08T12:27:56Z
---

## Notes

Roadmap F-02: auto-deploy to Cloudflare Workers on merge to `master`.

### Operator setup (one-time)

#### GitHub repository settings

Configure under **Settings → Secrets and variables → Actions**.

| Name | Type | Where | Purpose |
| ---- | ---- | ----- | ------- |
| `CLOUDFLARE_API_TOKEN` | Secret | Secrets | Wrangler deploy from CI |
| `PRODUCTION_URL` | Variable | **Variables** (repository level, not Environments) | Smoke check origin after deploy; no trailing slash |
| `SUPABASE_URL` | Secret | Secrets | CI build |
| `SUPABASE_KEY` | Secret | Secrets | CI build (anon/public key) |

**`CLOUDFLARE_API_TOKEN`** — create at Cloudflare dashboard → **My Profile → API Tokens → Create Token**. Minimum permissions:

- **Workers Scripts → Edit**
- **Workers KV Storage → Edit** (required — Worker binds KV namespace `SESSION`)

Scope the token to your Cloudflare account (account-level scope is fine when project-level is unavailable).

**`PRODUCTION_URL`** — full HTTPS origin with no trailing slash, e.g. `https://10xcards.<subdomain>.workers.dev`. Must match the live Worker URL shown in Cloudflare → Workers → `10xcards`. Use a **repository variable** so `${{ vars.PRODUCTION_URL }}` in `.github/workflows/ci.yml` resolves; environment-scoped variables are not visible unless the job declares `environment:`.

#### Cloudflare Worker runtime secrets

Set once per Worker (`10xcards`) via `npx wrangler secret put <NAME>`:

| Secret | Required for |
| ------ | ------------ |
| `SUPABASE_URL` | Auth and data |
| `SUPABASE_KEY` | Auth and data |
| `SUPABASE_SERVICE_ROLE_KEY` | Account deletion (`POST /api/auth/delete-account`) |
| `OPENROUTER_API_KEY` | AI flashcard generation |

CI build injects only `SUPABASE_URL` and `SUPABASE_KEY`. The production Worker must have all four runtime secrets or features fail silently while deploy and smoke check may still pass.

#### Rollback

- Bad Worker deploy: `npx wrangler rollback`
- Database migrations do **not** roll back with Worker rollback

#### Secret rotation

- **GitHub secrets/vars:** update in repo settings; next push to `master` picks up new build secrets automatically.
- **Wrangler runtime secrets:** `npx wrangler secret put <NAME>` overwrites the previous value; no redeploy required for secret-only changes, but redeploy if unsure.
