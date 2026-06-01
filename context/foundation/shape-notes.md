---
project: "10xCards"
context_type: brownfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
created: 2026-05-29
updated: 2026-05-30
status: draft
version: 1
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "vision direction"
      decision: "paper aesthetic (C) + study-hub structure (A elements) — not visual-only"
    - topic: "effort level"
      decision: "L — dashboard + global theme tokens + public landing rebrand (paper identity)"
    - topic: "mvp proof"
      decision: "study-first — due hero + Study CTA to /sets/<id>/review"
    - topic: "scope cut (3 weeks)"
      decision: "dashboard paper theme + study-hub layout + due_count SSR + landing rebrand (user decision 2026-05-30)"
    - topic: "landing scope"
      decision: "include — public `/` uses 10xCards copy + paper theme; sign-in/sign-up CTAs preserved"
    - topic: "set detail theme"
      decision: "include — `/sets/<id>` uses same paper theme tokens as dashboard/landing; review session UI deferred"
    - topic: "landing hero copy"
      decision: "variant A (punchy) in landing-copy.md — Flashcards from your text. Reviews on autopilot."
    - topic: "create UX"
      decision: "+ New set tile with modal or inline — not dominant create section"
    - topic: "lifecycle UX"
      decision: "rename/delete in ⋯ menu on set tile"
    - topic: "auth"
      decision: "no changes — email/password + flat roles preserved"
    - topic: "UI language"
      decision: "English on dashboard"
    - topic: "domain rule"
      decision: "prioritize cards due for study today"
  frs_drafted: 12
  quality_check_status: accepted
seed_idea: "context/foundation/dashboard-redesign-proposal.md — dashboard looks like 10x Astro Starter admin panel, not a study app; redesign to paper notes aesthetic + study hub."
---

## Current System

**Product:** 10xCards — web app (Astro 6 SSR + React islands, Supabase, Cloudflare Workers).

**Dashboard today:** `/dashboard` is a vertical stack: header “Your sets”, HTML form “Create a new set”, `FlashcardGenerator` island, `SetDashboardList` (rows with link + Edit/Delete). Cosmic glass styling (`bg-cosmic`, white/10 borders) matches `Welcome.astro` starter — not product identity.

**Already implemented (must preserve):** Set create (POST `/api/flashcard-sets/create`), rename/delete on list (`SetDashboardList` + update/delete APIs), `card_count` via `flashcards(count)` SSR, AI generator with `dashboard-set-sync` CustomEvent after bulk save, SRS at `/sets/<id>/review`, settings/account deletion via Topbar → `/settings`.

**Database:** `flashcards.due_at` and SRS APIs exist; dashboard does not yet surface due counts.

**Users:** Individual learners; email/password; flat roles; private sets (RLS).

## Vision & Problem Statement

**Delta:** After login, the home screen still reads as a generic starter admin panel (create form + generator + CRUD list), not “what should I study today?”. The product’s north star (AI + sets + SRS) is implemented in the backend but not reflected in dashboard hierarchy or visual identity.

**Insight:** Data for study prioritization (`due_at`, card counts) already exists — the gap is UX and information architecture, not a new domain engine. A paper-notes visual system plus study-first layout differentiates 10xCards from the template without requiring schema migrations.

## User & Persona

**Persona:** Individual learner (student, professional, self-learner) — unchanged.

**Moment:** Opens `/dashboard` between study sessions to see what is due today, continue review, or add material — not to “manage records” in an admin UI.

**Cost today:** Cognitive load — unclear whether to create, generate, or study first; SRS and due state are invisible on the home screen; visual language says “10x Astro Starter,” not flashcards.

## Access Control

**Current model:** Email + password; flat user model; sets private per owner (RLS).

**Change in this slice:** No auth, role, or RLS changes. Dashboard remains a protected route.

## Success Criteria

### Primary

- A logged-in user on `/dashboard` sees how many cards are due today (aggregate and/or per set), can start review via a clear **Study** action on a set tile, and lands on `/sets/<id>/review` without workarounds.

### Secondary

- Dashboard and public landing use a warm paper-notes aesthetic (off-white, readable typography); dashboard uses set **tiles** instead of an admin list; AI generator is available but secondary (e.g. collapsible section).

### Guardrails

- No regression: create set, rename/delete set (⋯ menu), AI generate + save with live `card_count` sync, open set detail, Topbar Settings/Sign out, SRS review behavior.
- Only owner sees their due counts and sets (existing RLS).
- English UI copy on dashboard, landing, and set detail for this slice.

## User Stories

### US-01: User opens dashboard and starts study from due state

- **Given** a logged-in user with at least one flashcard set and some cards due today
- **When** they open `/dashboard`
- **Then** they see a due-today summary and can click **Study** on a set tile to start `/sets/<id>/review`

#### Acceptance Criteria

- Aggregate or per-set due counts reflect `due_at <= now` (same semantics as SRS due API)
- Study CTA navigates to existing review route
- If nothing is due, user sees clear empty state (not a broken hero)

### US-03: Visitor sees 10xCards on the public landing

- **Given** an unauthenticated visitor
- **When** they open `/`
- **Then** they see 10xCards value proposition (AI flashcards + spaced repetition), paper-notes styling, and working Sign in / Sign up paths — not starter-template branding

#### Landing copy (default)

See `context/changes/study-hub-ui/landing-copy.md`. Headline: *Flashcards from your text. Reviews on autopilot.*

### US-04: User opens set detail with consistent paper theme

- **Given** a logged-in user who owns a flashcard set
- **When** they open `/sets/<id>` from a dashboard tile
- **Then** the page uses paper-notes styling (shared tokens), shows set name, **Start review**, and card management — without cosmic/glass starter chrome

### US-02: User manages sets without admin-panel dominance

- **Given** a logged-in user on `/dashboard`
- **When** they need a new set, rename, or delete
- **Then** they use **+ New set** tile and ⋯ menu on tiles — not a full-width create form stack

## Functional Requirements

### Dashboard / study hub (new & modified)

- FR-001: User sees a due-today summary on the dashboard (total due and/or per-set due counts). Priority: must-have. Change: new
  > Socrates: Counter-argument: "wrong counts erode trust in SRS." Resolution: kept — counts must use same `due_at` rule as review API; manual verify against review session.
- FR-002: User can start spaced-repetition review for a set from the dashboard via a primary **Study** action on the set tile. Priority: must-have. Change: new
  > Socrates: No counter-argument; links to existing review route. Stands as written.
- FR-003: User browses sets as tiles (not an administrative row list) with card count and due count visible on each tile. Priority: must-have. Change: modified
  > Socrates: Counter-argument: "tiles hide actions." Resolution: kept tiles + ⋯ menu for rename/delete.
- FR-004: User can create a new named set from a **+ New set** tile (modal or inline), not a dominant top-level form section. Priority: must-have. Change: modified
  > Socrates: No counter-argument; matches study-first IA. Stands as written.
- FR-005: User can rename or delete a set from the dashboard via a contextual menu on the set tile. Priority: must-have. Change: modified
  > Socrates: No counter-argument; preserves S-05 behavior with cleaner chrome. Stands as written.

### Preserved capabilities

- FR-006: User can generate flashcards with AI and save them to a selected set from the dashboard. Priority: must-have. Change: preserved
  > Socrates: Counter-argument: "collapsible hides AI north star." Resolution: kept preserved but de-emphasized visually — study-first hierarchy per slice goal.
- FR-007: After saving cards from the generator, the dashboard set list updates card counts without a full page reload. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; `dashboard-set-sync` must remain wired. Stands as written.
- FR-008: User can open a set’s detail page from a set tile. Priority: must-have. Change: preserved
  > Socrates: No counter-argument. Stands as written.
- FR-009: User can reach account settings and sign out from the dashboard shell. Priority: must-have. Change: preserved
  > Socrates: No counter-argument. Stands as written.
- FR-010: Dashboard presents a paper-notes visual identity (warm off-white, non-cosmic styling) using shared theme tokens. Priority: must-have. Change: new
  > Socrates: Counter-argument: "theme drift on other pages." Resolution: accept — global.css tokens on dashboard, landing, set detail; review session UI follow-up.
- FR-011: Visitor on the public landing page (`/`) sees 10xCards product messaging and the same paper-notes visual identity (not starter-template branding). Priority: must-have. Change: new
  > Socrates: Counter-argument: "scope creep vs 3-week budget." Resolution: user explicitly included landing in slice (2026-05-30); share theme tokens with dashboard.
- FR-012: User on a set detail page (`/sets/<id>`) sees the same paper-notes visual identity as the dashboard (not cosmic starter styling); card CRUD and **Start review** behavior unchanged. Priority: must-have. Change: modified
  > Socrates: Counter-argument: "review page still cosmic = jarring hop." Resolution: review session UI stays out of slice; set detail + dashboard + landing share tokens first.

## Business Logic

The application prioritizes surfacing flashcards that are due for spaced repetition today and routes the user to study before set creation or library housekeeping.

Supporting behavior: due counts are derived from existing `due_at` timestamps (cards with `due_at <= now` in the user’s timezone/UTC as implemented today). Set tiles also show total card count for context. No change to FSRS grading rules or AI extraction.

## Constraints & Preserved Behavior

- **No DB migrations** — `due_count` is computed from existing `flashcards.due_at` via SSR/query, not new columns.
- **RLS:** Unchanged; user sees only own sets and cards.
- **APIs:** No breaking changes to card CRUD, SRS grade/due, AI generate, or set update/delete endpoints.
- **Cross-island sync:** `DASHBOARD_SET_CARDS_ADDED` event after generator save must keep working.
- **URLs:** `/sets/<id>`, `/sets/<id>/review`, `/settings` unchanged.
- **Deployment:** Astro SSR + Cloudflare Workers; no new secrets.

## Non-Functional Requirements

- Dashboard first paint includes due summary and tiles from SSR (no client-only due fetch required for hero).
- Visual contrast readable on paper background (body text, buttons, focus states).
- Rename/delete and Study actions remain usable on mobile-width layout (responsive tile grid).

## Non-Goals

- **No full Polish localization / i18n** — English copy on dashboard; PL strings in proposal are reference only.
- **No redesign of review session UI** (`/sets/<id>/review`) — functional SRS flow unchanged; may keep prior styling until follow-up (visual hop from set detail acceptable for this slice).
- **No new purple glassmorphism layer** — explicit move away from cosmic starter look.
- **No DB schema changes, trash/restore, or bulk delete.**
- **No auth model changes.**
- **No requirement to fix generator dropdown stale names after rename** (known S-05 limitation) — optional follow-up.

## Product framing (brownfield)

- **product_type:** web-app — no change.
- **target_scale:** medium users — no change.
- **timeline_budget:** ~3 delivery weeks, after-hours only, no hard deadline.

## Forward: tech-stack

Informational only (not PRD): reuse Astro + React islands + Tailwind 4 + shadcn; extend `global.css` with paper theme tokens; optional fonts (e.g. Instrument Serif + DM Sans) per proposal — final font choice at plan time.

## Forward: technical-roadmap

- Add roadmap slice `study-hub-ui` or `dashboard-redesign` after shaping (depends on S-01, S-04, S-05 implemented).
- Suggested change folder: `context/changes/study-hub-ui/` for `/10x-plan` → `/10x-implement`.

## Quality cross-check

| Element | Status |
| -------- | ------ |
| Access Control | present |
| Business Logic (one-sentence rule) | present |
| Project artifacts | present |
| Timeline-cost acknowledged | present (3 delivery_weeks; landing + set detail added 2026-05-30 — timeline pressure noted) |
| Non-Goals | present |
| Preserved behavior | present |

Status: **accepted**
