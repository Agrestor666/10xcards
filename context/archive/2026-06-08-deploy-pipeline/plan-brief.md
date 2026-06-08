# Deploy pipeline (F-02) — Plan Brief

> Full plan: `context/changes/deploy-pipeline/plan.md`

## What & Why

Every feature slice needs a production release path. Today CI only lint+builds; deploy is manual `wrangler deploy`. F-02 closes that gap so merge to `master` automatically ships to the `10xcards` Cloudflare Worker — matching the roadmap and eliminating recurring deploy friction.

## Starting Point

`.github/workflows/ci.yml` gates PRs and pushes with lint+build. `wrangler.jsonc` is production-ready (Worker name, KV, assets). GitHub already has `SUPABASE_URL` / `SUPABASE_KEY` for builds. Runtime secrets live in Wrangler (documented for account deletion); no `CLOUDFLARE_API_TOKEN` or deploy job exists.

## Desired End State

Merge to `master` → CI passes → deploy job rebuilds and runs `wrangler deploy` → HTTP smoke check on `PRODUCTION_URL/` returns 200. Operators have a one-time setup checklist for GitHub secrets/vars and Wrangler runtime secrets. README/CLAUDE reflect auto-deploy.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Workflow shape | Deploy job in existing `ci.yml` | Deploy gated on same commit that passed lint+build | Plan |
| Preview deploys | Out of scope | Matches roadmap F-02 MVP | Plan |
| Build in deploy | Rebuild in deploy job | Simple; no artifact plumbing | Plan |
| Post-deploy check | HTTP smoke on `/` | Catches catastrophic failures; landing is public | Plan |
| Runtime secrets | Document one-time `wrangler secret put` | Secrets stay in Cloudflare; CI only adds deploy token | Plan |
| Deploy tool | `cloudflare/wrangler-action@v4` | Official action; `command: deploy` | Plan |
| Branch trigger | `master` only | Matches existing workflow | Research |

## Scope

**In scope:**
- `deploy` job in `.github/workflows/ci.yml` (`needs: ci`, push to `master` only)
- `CLOUDFLARE_API_TOKEN` GitHub secret + `PRODUCTION_URL` repo variable
- Post-deploy `curl` smoke check on `/`
- Operator runbook in `change.md`; README + CLAUDE updates

**Out of scope:**
- PR preview deployments
- GitHub → Wrangler secret sync in CI
- Custom domain, app code changes, Supabase migration CI

## Architecture / Approach

```
PR or push → master
  └─ ci job: npm ci → lint → build (all events)
  └─ deploy job (push to master only, needs ci):
       npm ci → build → wrangler deploy → curl PRODUCTION_URL/
```

Runtime secrets (`SUPABASE_*`, `OPENROUTER_API_KEY`) remain in Cloudflare Worker bindings via `wrangler secret put` — not injected by CI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Deploy job in CI | `deploy` job + wrangler-action on `master` | Token permissions; branch name `master` not `main` |
| 2. HTTP smoke check | `curl` against `vars.PRODUCTION_URL` | Wrong URL or redirect on `/` causes false failures |
| 3. Runbook + docs | `change.md` setup + README/CLAUDE | Runtime secrets missing → features break despite green CI |

**Prerequisites:** Cloudflare account access; GitHub repo admin for secrets/vars; Wrangler runtime secrets set on `10xcards` Worker before first smoke-enabled deploy.

**Estimated effort:** ~1 focused session across 3 phases.

## Open Risks & Assumptions

- `CLOUDFLARE_API_TOKEN` must have Workers Scripts Edit — too-narrow scope fails deploy with opaque auth errors.
- Smoke check on `/` assumes public landing stays unauthenticated (true today per middleware).
- Green deploy + smoke does not prove runtime secrets are set — manual feature smoke (auth, AI, delete account) still needed once.
- Duplicate build on merge adds ~1–2 min; acceptable at current scale.

## Success Criteria (Summary)

- Merge to `master` deploys automatically without manual `wrangler deploy`.
- PRs run CI only — no deploy job.
- Smoke step fails if production URL is unreachable or non-200.
- Operator runbook enables first-time setup without tribal knowledge.
