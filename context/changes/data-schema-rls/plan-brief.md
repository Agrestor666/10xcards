# Data Schema + RLS (F-01) — Plan Brief

> Full plan: `context/changes/data-schema-rls/plan.md`
> Research: (none — planning used roadmap + codebase exploration)

## What & Why

10xCards needs a persistent, private data layer before any feature slice can ship. F-01 adds Supabase tables for flashcard sets and cards with row-level security so each user only sees their own content — the infra gate for S-01 through S-04.

## Starting Point

Auth-only Supabase integration exists (SSR cookie client, middleware `getUser()`). There are no migrations, no `src/types.ts`, and no runtime references to flashcard tables. README still documents auth-only usage.

## Desired End State

`flashcard_sets` and `flashcards` exist locally (and can be pushed to cloud) with RLS enforced for `authenticated` users. TypeScript entity types in `src/types.ts` match the schema. S-01 can implement set UI/API against a stable contract without another schema migration for basic CRUD or SRS storage shape.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ------------------ | ------ |
| SRS storage | JSONB `srs_state` + `due_at` | Library-agnostic until S-04; `due_at` supports session queries | Plan |
| Set delete | CASCADE to cards | Matches user expectation; no orphan rows | Plan |
| F-01 scope | Migration + RLS + `src/types.ts` only | Clean foundation per roadmap; no API/UI | Plan |
| Set fields | `name` only | Satisfies FR-003/007 without extra columns | Plan |
| Ownership RLS | `user_id` on sets; cards via set join | Single ownership source; no denormalized `user_id` on cards | Plan |
| New card defaults | `due_at = now()`, `srs_state = '{}'` | Cards reviewable immediately (US-02) | Plan |
| Card text | TEXT NOT NULL | PRD requires non-empty Q+A; no arbitrary cap | Plan |
| Deploy migration | Local reset + documented remote push | CI has no DB secrets; operator pushes to cloud | Plan |

## Scope

**In scope:**

- One SQL migration: tables, indexes, FKs, RLS policies
- `src/types.ts` entity types
- README update for migrations workflow

**Out of scope:**

- API routes, UI, SRS library integration
- Generated Supabase types, smoke endpoints
- Remote CI migration apply

## Architecture / Approach

```
auth.users (existing)
    └── flashcard_sets (user_id → auth.uid() RLS)
            └── flashcards (set_id CASCADE, RLS via EXISTS on owned set)
                    ├── question, answer (text)
                    ├── srs_state (jsonb, default {})
                    └── due_at (timestamptz, default now())
```

Server continues using anon key + user session; Postgres RLS is the enforcement layer.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema migration | Tables, FKs, indexes, defaults | Wrong column set forces follow-up migration |
| 2. RLS policies | Owner-only CRUD for authenticated | Policy bug leaks or blocks legitimate access |
| 3. Types, docs & verification | `src/types.ts`, README, lint/build | Docs drift if push steps omitted on cloud |

**Prerequisites:** Docker for local Supabase; `.env` / `.dev.vars` with Supabase URL + anon key for app (unchanged).

**Estimated effort:** ~1 session, 3 short phases.

## Open Risks & Assumptions

- S-04 must define how `srs_state` and `due_at` stay in sync when grading is implemented; F-01 only stores defaults.
- Production schema lags until someone runs `supabase db push` manually.
- `updated_at` is not auto-maintained by triggers; app code in later slices should set it on UPDATE if needed.

## Success Criteria (Summary)

- Migration applies locally with `npx supabase db reset`
- Two test users cannot read each other's sets or cards
- `npm run lint` and `npm run build` pass; `src/types.ts` exports domain types
- Team can hand off to S-01 (`flashcard-sets-ui`) without another schema change for MVP CRUD + SRS storage
