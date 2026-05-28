# Set dashboard lifecycle — Plan Brief

> Full plan: `context/changes/set-dashboard-lifecycle/plan.md`
> PRD: `context/foundation/prd-v2.md`
> Shape: `context/foundation/shape-notes.md`

## What & Why

Logged-in users can create and open flashcard sets but cannot fix a misleading name or remove unwanted sets from the dashboard. This slice exposes owner-scoped rename and delete on the set list — high UX value with DB/RLS already in place.

## Starting Point

`/dashboard` SSR-lists sets and creates via HTML form POST; only `/api/flashcard-sets/create` exists. RLS allows `update`/`delete` on `flashcard_sets`; `flashcards` cascade on set delete. Card CRUD uses JSON APIs and a React island pattern on set detail.

## Desired End State

From `/dashboard`, users rename sets inline (1–80 chars), delete empty sets in one click, and delete non-empty sets after a modal shows the card count. The list updates without a full reload; deleted set URLs redirect to dashboard; other product flows unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Complexity | LOW | Two APIs + one island; no schema change | Plan |
| Rename UX | Inline edit on row | Matches cleanup workflow on the list | Plan |
| Non-empty delete UI | shadcn AlertDialog | True modal with card count per PRD | Plan |
| API style | POST JSON | Matches `flashcards/update` and `delete` | Plan |
| List refresh | Client React state | Snappy UX without reload | Plan |
| Empty set delete | No confirmation | Faster cleanup (shape/PRD) | Shape |
| Set detail actions | Out of scope | Dashboard only | PRD |
| Delete type | Hard delete + cascade | Existing DB behavior | Shape |
| Generator dropdown after rename | SSR snapshot until refresh | List is primary surface; avoid scope creep | Plan |

## Scope

**In scope:**
- `POST /api/flashcard-sets/update` and `POST /api/flashcard-sets/delete`
- `SetDashboardList` React island with inline rename + AlertDialog delete
- Dashboard query with per-set `card_count`
- Error mappers for set update/delete

**Out of scope:**
- Rename/delete on `/sets/<id>`
- Trash/restore, bulk delete
- Vitest/CI test additions
- Syncing `FlashcardGenerator` dropdown after rename without page refresh

## Architecture / Approach

```
dashboard.astro (SSR: sets + card_count)
    → SetDashboardList (client:load)
         → fetch POST /api/flashcard-sets/update | delete
              → Supabase (RLS) → flashcard_sets (+ CASCADE flashcards)
```

Create form and AI generator stay as today; set detail loader already handles missing sets after delete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API routes | update/delete endpoints + error mappers | Count/embed not needed here; 404 vs 403 messaging |
| 2. List island | AlertDialog + inline rename + client state | shadcn install; one-row edit state edge cases |
| 3. Dashboard wire | SSR count query + regression smoke | Supabase `flashcards(count)` response shape mapping |

**Prerequisites:** F-01 (schema/RLS), S-01 (`flashcard-sets-ui` — dashboard + create) implemented in repo.

**Estimated effort:** ~1–2 focused sessions across 3 phases.

## Open Risks & Assumptions

- Supabase embedded `flashcards(count)` select works as expected on hosted project (standard PostgREST feature).
- No automated tests — manual regression on cards/SRS/AI after delete.
- Generator set dropdown may show stale names until page refresh (accepted).

## Success Criteria (Summary)

- Rename and delete work end-to-end from `/dashboard` without workarounds.
- Empty delete: one click; non-empty: modal with correct card count.
- Only owner can mutate; deleted `/sets/<id>` is not reachable.
- Lint and build pass; no intentional regression on create, cards, SRS, or AI.
