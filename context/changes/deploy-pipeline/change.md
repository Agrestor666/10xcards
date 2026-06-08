---
change_id: deploy-pipeline
title: Deploy pipeline
status: implementing
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

## Notes

Roadmap F-02: auto-deploy to Cloudflare Workers on merge to `master`.

### Operator setup (one-time)

**GitHub repository settings**

| Name | Type | Purpose |
| ---- | ---- | ------- |
| `CLOUDFLARE_API_TOKEN` | Secret | Wrangler deploy from CI (Workers Scripts → Edit) |
| `PRODUCTION_URL` | Variable | Smoke check origin, no trailing slash (e.g. `https://10xcards.<subdomain>.workers.dev`). Must match the live Worker URL (`vars.PRODUCTION_URL` in CI). |
| `SUPABASE_URL` | Secret | CI build (already configured) |
| `SUPABASE_KEY` | Secret | CI build (already configured) |

**Cloudflare Worker runtime secrets** (`npx wrangler secret put <NAME>` on `10xcards`)

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — required for account deletion
- `OPENROUTER_API_KEY` — required for AI generation

CI build does not need service role or OpenRouter keys. Production Worker must have all four or features fail at runtime while deploy/smoke may still pass.

**Rollback:** `npx wrangler rollback` for bad Worker deploys. Database migrations do not roll back with Worker rollback.
