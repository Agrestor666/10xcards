---
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
---

## Why this stack

10xCards is a web-app in TypeScript with auth and AI text generation as the two technology-forcing features. The recommended default for (web, js) is 10x-astro-starter — Astro 6 + React 19 + TypeScript + Tailwind CSS 4 + Supabase (auth + PostgreSQL + TypeScript SDK) + Cloudflare Pages. Auth is first-class in the starter via Supabase; the LLM call for flashcard generation slots in as an Astro API route without requiring additional infrastructure. The 12-week, mixed-schedule timeline benefits from the starter's opinionated, fully-wired shape — less assembly overhead, more time shipping product. All four agent-friendly quality gates pass: typed (TypeScript end-to-end with Zod schemas at boundaries), convention-based (Astro file-based routing + island architecture), popular in training data, and well-documented. Deployment targets Cloudflare Pages with GitHub Actions auto-deploy on merge.
