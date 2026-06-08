# Repository Guidelines

10xCards is a web app built with the 10x Astro Starter stack: Astro 6 SSR, React 19 islands, TypeScript, Tailwind CSS 4, Supabase auth, and Cloudflare Workers deployment. See @CLAUDE.md for stack conventions and auth flow details.

## Hard Rules

- Never expose `SUPABASE_URL`, `SUPABASE_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` to the client — server-only via `astro:env`. Service role is for account deletion only.
- Always use `cn()` from `@/lib/utils` for conditional Tailwind classes; never concatenate class strings manually.
- Enable RLS on any new Supabase tables with per-operation, per-role policies.
- React components must be PascalCase (`SignUpForm.tsx`); utilities camelCase (`utils.ts`).

## Build & Dev Commands

Run these via npm:

- `npm run dev` — Start Cloudflare workerd dev server
- `npm run build` — Production SSR build (requires Supabase env vars)
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run format` — Prettier with astro + tailwind plugins

Pre-commit hooks (husky + lint-staged) auto-run `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Project Structure

- `src/layouts/` — Astro layouts
- `src/pages/` — Astro pages; API routes in `src/pages/api/`
- `src/components/ui/` — shadcn/ui components (install: `npx shadcn@latest add <name>`)
- `src/components/` — Other components; React for interactivity, Astro for static
- `src/lib/` — Utilities and services; Supabase SSR client at `src/lib/supabase.ts`
- `supabase/migrations/` — PostgreSQL migrations (`YYYYMMDDHHmmss_description.sql`)

Path alias `@/*` maps to `./src/*` per @tsconfig.json.

## Environment Setup

Copy @.env.example to `.env` (Node) and `.dev.vars` (Cloudflare local dev). Local Supabase: `npx supabase start` (requires Docker).

## CI Gate

GitHub Actions (`.github/workflows/ci.yml`): `lint` + `build` on push/PR to `master` (requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets). **Push to `master` only:** after CI passes, a `deploy` job runs `wrangler deploy` and curls `PRODUCTION_URL/` (requires `CLOUDFLARE_API_TOKEN` secret and `PRODUCTION_URL` repository variable).

## Deployment

Auto-deploy via GitHub Actions on push to `master`. One-time setup: `context/changes/deploy-pipeline/change.md`. Runtime secrets on the Worker (`SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`) via `npx wrangler secret put`. Emergency manual path: `npm run build && npx wrangler deploy`.
