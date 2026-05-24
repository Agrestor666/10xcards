---
project: 10xcards
researched_at: 2026-05-21T00:00:00Z
recommended_platform: Cloudflare Workers + Pages
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19 + Tailwind CSS 4
  runtime: workerd (Cloudflare Workers via @astrojs/cloudflare)
  database: PostgreSQL via Supabase (external)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages (via `@astrojs/cloudflare`).**

This repository already pins **`astro` ^6.3**, **`@astrojs/cloudflare` ^13.5**, and **`wrangler` ^4.90** with `output: "server"` and `wrangler.jsonc` targeting `@astrojs/cloudflare/entrypoints/server` plus `nodejs_compat` — migration cost is effectively zero versus alternatives that require swapping adapters or running containers. Interview answers favored **stateless HTTP** (no disqualifying need for persistent processes), **single-region** users (global edge is a bonus, not a requirement), and **external Supabase / OpenRouter** (no requirement for vendor co-located databases). Against that backdrop, maximizing **stack fidelity and agent-maintainability** points to staying on Cloudflare.

## Platform Comparison

Scores use **Pass** / **Partial** / **Fail** per criterion in `.cursor/skills/10x-infra-research/references/agent-friendly-criteria.md`. Weights reflected: **neutral** cost vs DX; **no** prior vendor tie-breaker; **single region** (slight de-emphasis on “edge” as deciding factor alone); **external** data tier (no bonus for bundled DB).

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP / integration | Total (Pass=2, Partial=1) |
|----------|-----------|---------------------|---------------------|-------------------|-------------------|----------------------------|
| **Cloudflare Workers + Pages** | Pass | Pass | Pass | Pass | Pass | **10** |
| **Netlify** | Pass | Pass | Pass | Pass | Pass | **10** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | **9** |
| **Fly.io** | Pass | Pass | Pass | Pass | Partial | **9** |
| **Railway** | Pass | Pass | Pass | Pass | Partial | **9** |
| **Render** | Partial | Pass | Pass | Pass | Partial | **8** |

**Notes per platform:**

- **Cloudflare** — `wrangler` covers deploy/tail/logs/rollback patterns; Workers docs expose `llms.txt` / markdown-friendly consumption ([Workers llms overview](https://developers.cloudflare.com/workers/llms.txt)); first-party Astro integration ([Astro on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)); MCP patterns documented ([MCP servers for Cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)).
- **Netlify** — Strong MCP ([Netlify MCP Server](https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/)); **Partial** implicit cost ergonomics due to credit-based billing for new accounts (from Sep 2025 — see [credit-based pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).
- **Vercel** — Excellent Astro SSR docs ([Astro on Vercel](https://vercel.com/docs/frameworks/frontend/astro)); MCP is **Partial** (**public beta** as of Aug 2025 — [changelog](https://vercel.com/changelog/vercels-mcp)).
- **Fly.io** — Strong CLI; pay-as-you-go; **weak “free tier” narrative** for many new accounts (budget discipline required — [pricing](https://fly.io/pricing), [cost management](https://fly.io/docs/about/cost-management/)).
- **Railway** — Simple container PaaS; **$5/mo Hobby floor** plus usage ([plans](https://docs.railway.com/pricing/plans)); idle services still incur resource cost ([understanding your bill](https://docs.railway.com/pricing/understanding-your-bill)).
- **Render** — Dashboard + hooks common; **free web services spin down** after inactivity (poor fit for SSR product UX — [free tier docs](https://render.com/docs/free)); marked **CLI Partial** versus fully non-interactive comfort for all ops.

**Hard filters applied:** Persistent WebSockets/workers-only processes **were not required** (interview); no runtime mismatch — all six can host a Node-style Astro build **provided the adapter matches** (this repo **requires** Cloudflare adapter unless changed).

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (recommended)

Wins on **alignment with pinned toolchain** (`astro.config.mjs` + `wrangler.jsonc`), official Astro 6 Workers guide, deterministic `wrangler deploy`, and docs suited to agents (`llms.txt`). External Supabase and OpenRouter fit naturally (`fetch` from API routes).

#### 2. Vercel (runner-up)

Strong Astro story and Hobby/Pro economics for serverless SSR, but **runner-up because** adopting it means **`@astrojs/vercel`**, re-validation of Supabase cookie flows, and re-learning env wiring — unjustified unless Cloudflare limits bite.

#### 3. Netlify (third)

Parity with Vercel on “swap adapter + validate”; official MCP is excellent. Credit-based metering adds forecasting overhead for a solo MVP versus Workers request-based pricing familiarity.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **Workers free-tier CPU quotas** may be incompatible with SSR + auth + heavier handlers; production-like load tests belong in the billing tier you intend to keep ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/)).
2. **`workerd` ≠ Node.js`** — dependency drift can introduce incompatible APIs despite `nodejs_compat`; each new npm package needs edge suitability review.
3. **Billing/product surface evolution** — e.g. **Dynamic Workers** pricing track ([Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/)); confirm whether deployment patterns trigger it **as of deploy date**.
4. **Multi-vendor operations** — app (Cloudflare) vs auth/DB (Supabase) vs LLM (OpenRouter) fractures incident response and quota debugging.
5. **Long-lived LLM I/O** must respect **timeouts, streaming behavior, response sizes, and subrequest limits** so PRD latency targets remain achievable without silent truncation.

### Pre-Mortem — How This Could Fail

The team stayed on Cloudflare because the starter fit Day 1. Flashcard generation grew heavier: larger prompts, streaming responses, richer middleware, and heavier JSON shaping. Observability showed intermittent **CPU limit** faults on hotter routes while waiting on upstreams — diagnosing **CPU vs I/O attribution** dragged on because production timings diverged from local `astro dev` profiles. An innocuous dependency pulled in Node-only globals and broke the edge bundle at deploy time; rollback via `wrangler rollback` revived the Worker, but the team lost days unpicking replacements. Invoice lines tied to newer Worker product classes appeared without clear mapping to routes. At that point frustration justified a forklift migration to containers — expensive not because Cloudflare failed categorically, but because **budgets, limits, and observability contracts** had been assumed “fine until proven otherwise.”

### Unknown Unknowns

- Exact **CPU accounting** during long `fetch`/`ReadableStream` handling for OpenRouter on your Astro routes — validate on the **paid** plan you intend to run.
- **Adapter minor releases** (`@astrojs/cloudflare` 13.x) can change defaults (image services, sessions, worker entry conventions) — reconcile every upgrade with Astro + Wrangler release notes, not generic tutorials.
- **`astro:env/server` secrets + Wrangler secrets** — single source of truth and rotation procedure must be documented so agents never echo server keys into client bundles.
- **Preview / Workers preview configuration** evolves with Wrangler (`wrangler.jsonc` `previews` block) — confirm branch preview UX against your Git provider setup when you enable it ([configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/)).

## Operational Story

- **Preview deploys**: Use **Workers preview deployments** (`wrangler` preview flow / dashboard previews as configured); protect sensitive previews with Cloudflare Access or equivalent if exposing real data-bound routes. Forked PR previews depend on CI wiring — align with `.github/workflows` and Cloudflare/Git integration policies.
- **Secrets**: **`wrangler secret put <NAME>`** for production/bindings; local dev uses **`.dev.vars`** (gitignored) mirroring Astro `astro:env` schema — never commit `.env` with production keys. Repo CI uses **`SUPABASE_URL` / `SUPABASE_KEY`** as GitHub Actions secrets per `CLAUDE.md`.
- **Rollback**: **`wrangler rollback`** (non-interactive) to a prior Worker version after a bad deploy; expect **minutes** propagation. Database migrations applied during a bad deploy **do not roll back** with Worker rollback — coordinate schema changes separately.
- **Approval**: Humans should approve **production secret rotation**, **custom domain**, and **destructive DB** actions; agents may run **`npm run lint`**, **`npm run build`**, and **read-only log tail** in controlled contexts.
- **Logs**: **`wrangler tail`** for runtime logs; **`wrangler deployments list`** / status for deploy audit; MCP-based doc queries optional per team setup (`workers-mcp`). Dashboard observability aligns with `wrangler.jsonc` `observability.enabled`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|------|--------|------------|--------|-------------|
| CPU/time limits break generation or SSR under load | Devil's advocate | M | H | Profile hottest routes on target plan; shorten work in-request; stream; upgrade Workers plan early if needed |
| Edge-incompatible npm package breaks build | Devil's advocate | M | H | Pin dependencies; CI `npm run build` gate; lint for Node-only APIs; test `astro build` locally |
| Invoice line items from Worker product subsets (e.g. Dynamic Workers) mis-scoped | Unknown unknowns | L | M | Read current pricing docs at deploy date; tag routes/bindings that opt into previews |
| OpenRouter timeouts or truncation vs PRD latency | Devil's advocate | M | H | Explicit fetch timeout + user-visible errors; chunked/streaming UX; circuit-break for provider faults |
| Multi-vendor outage confusion (CF vs Supabase vs OpenRouter) | Devil's advocate | M | M | Synthetic checks per dependency; status page bookmarks; isolate logs per vendor |

## Getting Started

For **pinned** versions (`astro` ^6.3, `@astrojs/cloudflare` ^13.5, `wrangler` ^4.90):

1. **Authenticate Wrangler**: `npx wrangler login` once on the workstation that deploys ([Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)).
2. **Local secrets**: Copy env patterns from `.env.example` into `.dev.vars` for Cloudflare dev; ensure `SUPABASE_URL` / `SUPABASE_KEY` match `astro.config.mjs` `env.schema`.
3. **Dev with production-like runtime**: `npm run dev` — Astro’s Cloudflare adapter runs against **workerd** (not vanilla Node SSR).
4. **Ship build**: `npm run build` (outputs `dist/` per `wrangler.jsonc` `assets.directory`).
5. **Deploy**: `npx wrangler deploy` from repo root (`wrangler.jsonc` defines `main` and assets — no separate Dockerfile required).

## Out of Scope

The following were not evaluated in this research:

- Dockerfile or image tuning for non-Workers hosts
- End-to-end CI/CD pipeline authoring (workflow exists but not redesigned here)
- Multi-region HA, DR strategies, enterprise SLAs, or sustained cost forecasting beyond MVP scale
