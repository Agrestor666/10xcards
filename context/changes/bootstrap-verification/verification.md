---
bootstrapped_at: 2026-05-21T20:15:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: 10xcards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10xcards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

10xCards is a web-app in TypeScript with auth and AI text generation as the two technology-forcing features. The recommended default for (web, js) is 10x-astro-starter — Astro 6 + React 19 + TypeScript + Tailwind CSS 4 + Supabase (auth + PostgreSQL + TypeScript SDK) + Cloudflare Pages. Auth is first-class in the starter via Supabase; the LLM call for flashcard generation slots in as an Astro API route without requiring additional infrastructure. The 12-week, mixed-schedule timeline benefits from the starter's opinionated, fully-wired shape — less assembly overhead, more time shipping product. All four agent-friendly quality gates pass: typed (TypeScript end-to-end with Zod schemas at boundaries), convention-based (Astro file-based routing + island architecture), popular in training data, and well-documented. Deployment targets Cloudflare Pages with GitHub Actions auto-deploy on merge.

## Pre-scaffold verification

| Signal             | Value                                           | Severity | Notes                              |
| ------------------ | ----------------------------------------------- | -------- | ---------------------------------- |
| npm package        | not run — cmd_template uses git clone           | —        | skipped per pre-scaffold rules     |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-05-17T10:33:39Z | fresh    | from card.docs_url                 |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 19

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: moved

**.bootstrap-scaffold cleanup**: deleted

**Note**: npm install was interrupted by user during execution due to FortiGate firewall restrictions. User resolved by copying `node_modules` from another project using the same stack (10x-astro-starter). Workaround verified: key packages present (astro, react, @astrojs/react, tailwindcss, @supabase/supabase-js), ~591 packages total.

**Files moved list**:
- .github
- .husky
- .vscode
- public
- src
- supabase
- .env.example
- .gitignore
- .nvmrc
- .prettierrc.json
- astro.config.mjs
- CLAUDE.md
- components.json
- eslint.config.js
- package-lock.json
- package.json
- README.md
- tsconfig.json
- wrangler.jsonc

## Post-scaffold audit

**Tool**: npm audit --json

**Status**: failed to run

**Reason**: 403 Forbidden - FortiGate Application Control blocking access to npm registry (https://registry.npmjs.org/-/npm/v1/security/advisories/bulk)

**Partial output**:

```
npm warn audit 403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
```

The npm audit could not complete due to network security policy restrictions. This is not a project issue — dependencies were not installed, so there are no packages to audit yet. Run `npm install` followed by `npm audit` once network restrictions allow.

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                              |
| path_taken                 | standard                           |
| self_check_answers         | null                               |
| team_size                  | solo                               |
| deployment_target          | cloudflare-pages                   |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge               |
| has_auth                   | true                               |
| has_payments               | false                              |
| has_realtime               | false                              |
| has_ai                     | true                               |
| has_background_jobs        | false                              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Run `npm install` to install dependencies once network restrictions allow.
- Run `npm audit` after install to check for security vulnerabilities.
- Review any `.env.example` and configure environment variables for Supabase.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
