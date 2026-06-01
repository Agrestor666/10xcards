---
project: "10xCards"
assessed_at: "2026-05-28T20:19:11+01:00"
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript
  framework: "Astro 6 SSR + React 19 islands"
  build_tool: "Astro (Vite 7)"
  test_runner: null
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 7
gates_failed: 3
---

## Stack Components

**Language — TypeScript 5.9:** Strict typing via `tsconfig.json` extending `astro/tsconfigs/strict` with path alias `@/*` → `./src/*`. ESLint uses `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` with `projectService: true` (`eslint.config.js`).

**Framework — Astro 6 + React 19:** Full SSR (`output: "server"` in `astro.config.mjs`), React islands for interactivity, file-based routing under `src/pages/`, API routes as `src/pages/api/**/*.ts` with uppercase HTTP method exports. Integrations: `@astrojs/react`, `@astrojs/cloudflare`, Tailwind 4 via `@tailwindcss/vite`.

**Data & auth — Supabase:** Server-only secrets via `astro:env` schema (`SUPABASE_URL`, `SUPABASE_KEY`). SSR client in `src/lib/supabase.ts` with `@supabase/ssr` cookie sessions. Migrations and RLS in `supabase/migrations/`; `flashcard_sets` already has owner-scoped `update` and `delete` policies.

**Validation — Zod 4:** API input validation pattern used across existing routes (e.g. flashcard set create).

**UI — Tailwind 4 + shadcn/ui-style components:** `src/components/ui/`, `cn()` from `@/lib/utils`, React components PascalCase per `AGENTS.md`.

**Build — Astro / Vite:** `npm run build` produces Cloudflare Worker output; `npm run dev` uses workerd runtime.

**Test runner — none detected:** No `vitest`, `jest`, or `playwright` config or test scripts in `package.json`.

**Package manager — npm:** `package-lock.json` present; CI uses `npm ci`.

**CI/CD — GitHub Actions:** `.github/workflows/ci.yml` runs `astro sync`, `lint`, and `build` on push/PR to `master` with Supabase secrets for build.

**Deployment — Cloudflare Workers:** `@astrojs/cloudflare` adapter, `wrangler.jsonc`, local secrets in `.dev.vars`.

**Instruction files:** `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/10x-course.mdc`, `.cursor/rules/context7.mdc` (library docs via Context7 MCP).

**Brownfield change scope (prd-v2):** Expose set rename and delete on `/dashboard` via new API routes and UI — no schema change required; aligns with existing Astro API + Supabase RLS patterns.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | ✓     | —          | —             | —          | pass    |
| Framework   | —     | ✓          | ✓             | ✓          | pass    |
| Build tool  | —     | ✓          | ✓             | ✓          | pass    |
| Test runner | —     | ✗          | ✗             | ✗          | fail    |

Legend: ✓ = pass, ✗ = fail, — = not applicable

## Gate Details

### Language — TypeScript

- **Typed — pass:** `tsconfig.json` extends `astro/tsconfigs/strict`; `eslint.config.js` enables `strictTypeChecked`. Evidence: both files in repo root.
- **Convention / training / docs — N/A** at language-only row (framework carries routing conventions).

### Framework — Astro 6 (+ React islands)

- **Convention-based — pass:** File-based routes (`src/pages/`), API routes under `src/pages/api/`, layouts in `src/layouts/`, React only where interactivity is needed. Middleware at `src/middleware.ts` for auth. Documented in `CLAUDE.md` / `AGENTS.md`.
- **Popular in training data — pass:** Astro and React are mainstream in the JavaScript/TypeScript ecosystem; patterns match widespread agent training corpora.
- **Well-documented — pass:** [docs.astro.build](https://docs.astro.build) versioned; Cloudflare adapter documented; React integration documented.

### Build tool — Astro (Vite)

- **Convention-based — pass:** Scripts and config centralized in `astro.config.mjs`; env schema declared in config.
- **Popular in training data — pass:** Vite-backed Astro builds are common in JS meta-framework docs.
- **Well-documented — pass:** Build/deploy flows documented for Astro + Cloudflare.

### Test runner — not detected

- **Convention-based — fail:** No `tests/` or `__tests__/` layout, no test script in `package.json`, no vitest/jest/playwright config. Agents have no project-local pattern for automated tests.
- **Popular in training data — fail (in context):** Without a declared runner, agents cannot rely on a single idiomatic test style for this repo.
- **Well-documented — fail:** No in-repo testing guide; only implicit manual verification via CI (lint + build).

### Supabase (change-relevant dependency)

Not scored as a separate row (not a language/framework), but **passes implicitly** for this slice: RLS and migrations are convention-heavy; official Supabase docs are strong; `@supabase/ssr` + Astro patterns are well represented in training data. **Risk:** agents may hallucinate service-role usage — compensate with explicit owner-scoped client rules (below).

## Gaps & Compensation

### Gap 1: No automated test runner

**Why it matters:** Agents cannot run tests to verify rename/delete API behavior or RLS regressions; CI only catches type/lint/build errors.

**Compensation:**

```markdown
## Testing (10xCards — manual until Vitest added)

No test runner is configured. After changes to API routes or dashboard UI:

1. Run `npm run lint` and `npm run build` locally.
2. Manually verify on `/dashboard`: rename updates the list; delete empty set is one action; delete non-empty set shows card count before confirm; deleted set URL is unreachable.
3. Confirm another user's sets cannot be renamed/deleted (RLS).
4. Confirm card CRUD, SRS review, and AI generator still work.

When adding Vitest later, colocate tests next to `src/pages/api/` handlers and document the command in AGENTS.md.
```

### Gap 2: Set-management slice needs explicit API conventions

**Why it matters:** prd-v2 adds update/delete alongside existing create; agents must mirror established patterns to avoid auth or validation drift.

**Compensation:**

```markdown
## Flashcard set API conventions

- New set endpoints live under `src/pages/api/flashcard-sets/` (match `create.ts`).
- Export uppercase `POST` / `PATCH` or `DELETE` handlers; set `export const prerender = false` on API routes.
- Validate input with Zod; reuse name rules from `@/lib/flashcard-set-name.ts` (1–80 characters).
- Use `createClient(Astro.request.headers, Astro.cookies)` — never expose `SUPABASE_URL` / `SUPABASE_KEY` to the client.
- Rely on RLS for authorization; do not use service-role keys on user-facing routes.
- Touch `updated_at` on parent set when mutating cards (see `@/lib/flashcard-set-touch.ts`).
```

### Gap 3: Dashboard UI placement (prd-v2 non-goal)

**Why it matters:** Shape notes restrict rename/delete to `/dashboard` only — agents might duplicate actions on set detail.

**Compensation:**

```markdown
## Set rename/delete UI scope

- Implement rename and delete controls only on `src/pages/dashboard.astro` (or a React island imported there).
- Do not add set-level delete/rename to `src/pages/sets/[id]/index.astro` in this change.
- Empty set: delete without confirmation. Non-empty set: confirmation showing card count.
```

## Recommended Instruction File Additions

Copy the three markdown blocks under **Gaps & Compensation** into `AGENTS.md` (or `CLAUDE.md`) when starting implementation of prd-v2. Existing `AGENTS.md` already covers auth, `cn()`, RLS, and API style — these entries extend it for the set-management slice and testing gap.

## Summary

**Overall agent-readiness: ready-with-compensation**

**Strengths:** TypeScript strict mode, opinionated Astro layout, strong instruction files (`CLAUDE.md` / `AGENTS.md`), Zod at API boundaries, Supabase RLS already aligned with prd-v2, CI gate on lint/build.

**Gaps:** No automated tests — compensate with explicit manual verification checklist until a test runner is added.

**prd-v2 fit:** Stack is well suited for this change (small API + dashboard UI delta). No framework migration required.

**Recommended next step:** `/10x-health-check` — dependency audit, confirm CI coverage gaps (tests), and security/RLS advisors before `/10x-plan` or `/10x-implement`.
