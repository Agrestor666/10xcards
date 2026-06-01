---
project: "10xCards"
version: 3
status: draft
created: 2026-05-29
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
---

## Current System Overview

**Purpose:** 10xCards helps individual learners turn raw study text into flashcards and review them on a spaced-repetition schedule.

**Architecture:** Server-rendered web application with interactive islands, authenticated sessions, and a hosted relational datastore.

**Tech stack:** Astro SSR, React islands, Supabase (auth + database), deployed on Cloudflare Workers.

**User base:** Individual learners (students, professionals, self-learners) with email/password accounts; flat role model; private flashcard sets per owner.

**Dashboard today:** After login, `/dashboard` is a vertical stack: a header (“Your sets”), a prominent “Create a new set” form, an AI flashcard generator, and a row-based set list with inline edit/delete. Visual styling matches the starter landing page (cosmic glass theme), not a study-focused product identity.

**Already implemented (relevant to this change):** Set create, rename, and delete on the dashboard; card counts on the list; AI generation with live card-count updates after save; spaced-repetition review at `/sets/<id>/review`; account settings and sign-out via the top bar. The datastore already stores per-card review due timestamps; the dashboard does not yet show how many cards are due today.

## Problem Statement & Motivation

**Gap:** After login, the home screen still reads as a generic admin panel (create form + generator + CRUD list), not “what should I study today?”. The product’s north star (AI + sets + spaced repetition) is implemented in the backend but not reflected in dashboard hierarchy or visual identity.

**Why now:** SRS and due state exist in the product; learners still cannot see due-for-today at a glance or start review from the home screen without hunting. Competing study apps surface “due now” on the first screen — this gap hurts perceived product fit.

**Current workaround:** Users infer what to do from multiple equal-weight sections (create, generate, list) or navigate into a set before starting review.

**Insight:** Data for study prioritization (due timestamps, card counts) already exists — the gap is UX and information architecture, not a new scheduling engine. A warm paper-notes visual system plus study-first layout differentiates 10xCards from the template without requiring schema changes.

## User & Persona

**Persona (unchanged):** Individual learner — student, professional, self-learner.

**Moment:** Opens `/dashboard` between study sessions to see what is due today, continue review, or add material — not to “manage records” in an admin UI.

**Delta:** Today the dashboard emphasizes creation and library housekeeping; after this change it emphasizes due-for-today and a clear **Study** path per set, with create/rename/delete available but de-emphasized.

## Success Criteria

### Primary

- A logged-in user on `/dashboard` sees how many cards are due today (aggregate and/or per set), can start review via a clear **Study** action on a set tile, and reaches the existing review flow without workarounds.

### Secondary

- Dashboard and public landing use a warm paper-notes aesthetic (off-white, readable typography); dashboard uses set **tiles** instead of an administrative row list; AI generation remains available but visually secondary (e.g. collapsed by default).

### Guardrails

- No regression: create set, rename/delete set (via contextual menu on tiles), AI generate + save with live card-count sync, open set detail, top-bar settings/sign out, spaced-repetition review behavior.
- Only the owner sees their due counts and sets (existing privacy model).
- English UI copy on the dashboard and public landing for this slice.
- Due summary and set tiles are present on first paint without requiring a client-only fetch for the hero state.
- Study, rename/delete, and tile layout remain usable on narrow viewports.

## User Stories

### US-01: User opens dashboard and starts study from due state

- **Given** a logged-in user with at least one flashcard set and some cards due for study today
- **When** they open `/dashboard`
- **Then** they see a due-today summary and can click **Study** on a set tile to start the existing review session for that set

**Before:** Due state was not visible on the dashboard; review started only after navigating into a set.

#### Acceptance Criteria

- Aggregate and/or per-set due counts use the same due-for-study rule as the review session (cards due as of now)
- **Study** navigates to the existing review route for the selected set
- If nothing is due, the user sees a clear empty state (not a broken hero)

### US-03: Visitor sees 10xCards on the public landing

- **Given** an unauthenticated visitor
- **When** they open `/`
- **Then** they see 10xCards value proposition (AI flashcards + spaced repetition), paper-notes styling, and working Sign in / Sign up paths — not starter-template branding

**Before:** Landing showed starter-template title, copy, and cosmic glass styling.

#### Acceptance Criteria

- Page title and hero copy reflect 10xCards product (not generic starter messaging)
- Visual styling matches shared paper theme tokens used on the dashboard
- Sign in and Sign up links behave as today (no auth flow change)
- Copy follows `context/changes/study-hub-ui/landing-copy.md` (variant A: punchy headline + three feature cards)

### US-04: User opens set detail with consistent paper theme

- **Given** a logged-in user who owns a flashcard set
- **When** they open `/sets/<id>` from a dashboard tile
- **Then** the page uses paper-notes styling (shared tokens), shows set name, **Start review**, and card management — without cosmic/glass starter chrome

**Before:** Set detail used the same cosmic glass styling as the starter template.

#### Acceptance Criteria

- Page shell uses shared paper theme (not `bg-cosmic` / glass panels)
- **Start review** links to existing review route and works as today
- Card add/edit/delete in the set is unchanged functionally

### US-02: User manages sets without admin-panel dominance

- **Given** a logged-in user on `/dashboard`
- **When** they need a new set, rename, or delete
- **Then** they use a **+ New set** tile and a contextual menu on set tiles — not a full-width create form stack

**Before:** Create was a dominant top-level form; rename/delete were inline on list rows.

#### Acceptance Criteria

- **+ New set** creates a named set (same name rules as today: 1–80 characters)
- Rename and delete remain available from the dashboard with the same confirmation rules for non-empty sets as today
- Set tiles show card count and due count for context

## Scope of Change

### New

- [new] User sees a due-today summary on the dashboard (total due and/or per-set due counts).
  > Socrates: Counter-argument: "wrong counts erode trust in spaced repetition." Resolution: kept — counts must use the same due-for-study rule as the review session; verify manually against a review session.
- [new] User can start spaced-repetition review for a set from the dashboard via a primary **Study** action on the set tile.
  > Socrates: No counter-argument; links to existing review route. Stands as written.
- [new] Dashboard presents a paper-notes visual identity (warm off-white, non-cosmic styling) using shared theme tokens.
  > Socrates: Counter-argument: "theme drift on other pages." Resolution: accept — global theme tokens on dashboard, landing, and set detail; review session may lag until follow-up.
- [new] Visitor on the public landing page sees 10xCards product messaging and the same paper-notes visual identity (not starter-template branding); Sign in and Sign up remain available.
  > Socrates: Counter-argument: "scope creep vs 3-week budget." Resolution: user explicitly included landing in slice (2026-05-30); share theme tokens with dashboard.

### Modified

- [modified] User browses sets as tiles (not an administrative row list) with card count and due count visible on each tile.
  > Socrates: Counter-argument: "tiles hide actions." Resolution: kept tiles + contextual menu for rename/delete.
- [modified] User can create a new named set from a **+ New set** tile (inline or lightweight prompt), not a dominant top-level form section.
  > Socrates: No counter-argument; matches study-first information architecture. Stands as written.
- [modified] User can rename or delete a set from the dashboard via a contextual menu on the set tile (same lifecycle rules as today).
  > Socrates: No counter-argument; preserves prior dashboard lifecycle behavior with cleaner chrome.
- [modified] AI flashcard generation on the dashboard is de-emphasized in layout (e.g. secondary section, collapsed by default) while remaining fully available.
  > Socrates: Counter-argument: "hiding AI undermines the north star." Resolution: kept preserved but de-emphasized — study-first hierarchy per slice goal.
- [modified] Set detail page (`/sets/<id>`) uses the same paper-notes visual identity as dashboard and landing; card list, manual CRUD, and **Start review** behavior unchanged.
  > Socrates: Counter-argument: "review page still old theme = jarring." Resolution: review session UI out of slice; set detail aligned with study hub first.

### Preserved

- [preserved] User can generate flashcards with AI and save them to a selected set from the dashboard.
  > Socrates: No counter-argument. Stands as written.
- [preserved] After saving cards from the generator, the dashboard set list updates card counts without a full page reload.
  > Socrates: No counter-argument; live count sync must remain wired. Stands as written.
- [preserved] User can open a set’s detail page from a set tile.
- [preserved] User can reach account settings and sign out from the dashboard shell.
- [preserved] Spaced-repetition grading and scheduling rules on the review session are unchanged.

## Constraints & Compatibility

- **Data:** No schema migrations; due counts are computed from existing per-card due timestamps at read time, not new columns.
- **Access:** Unchanged owner-only visibility for sets and cards.
- **APIs:** No breaking changes to card CRUD, review grading/due endpoints, AI generation, or set update/delete endpoints.
- **Cross-component sync:** Card-count updates after generator save must continue to work without full page reload.
- **URLs:** `/`, `/dashboard`, `/sets/<id>`, `/sets/<id>/review`, `/settings` remain stable; `/` remains the public entry point.
- **First paint:** Due summary and set tiles are server-rendered with the dashboard; the hero does not depend on a client-only due fetch.
- **Readability:** Text and controls meet readable contrast on the paper background, including focus states.
- **Preserved flows:** Create set, rename/delete, AI generate + save, open set detail, review session, settings/sign out — no intentional regression beyond layout and prioritization.
- **Deployment:** No new secrets or infrastructure beyond the existing application host.

## Business Logic Changes

**New product prioritization rule:** The application prioritizes surfacing flashcards that are due for spaced repetition today and routes the user to study before set creation or library housekeeping on the dashboard.

**Supporting behavior (unchanged scheduling):** Due counts reflect cards due for study as of now, using the same rule as the review session. Set tiles also show total card count for context. Spaced-repetition grading and interval rules are not modified. AI extraction rules are not modified.

## Access Control Changes

No access control changes — current model preserved. Email/password registration, flat roles, private sets per owner, and protected dashboard route remain as today.

## Non-Goals

- **No full Polish localization / i18n** — English copy on the dashboard; Polish strings in design notes are reference only.
- **No redesign of review session UI** (`/sets/<id>/review`) — SRS interaction unchanged; styling may differ from set detail until a follow-up slice.
- **No new cosmic/glass starter aesthetic** — explicit move away from the template look on the dashboard.
- **No database schema changes, trash/restore, or bulk delete.**
- **No auth model changes.**
- **No requirement to fix generator set-picker stale names after rename** (known limitation from prior slice) — optional follow-up.

## Open Questions

1. **Due summary shape on the hero** — Should the dashboard emphasize aggregate due across all sets, per-set counts on tiles only, or both a total and per-set breakdown? Owner: user or implementer at plan time. Block: no (either pattern satisfies FR-001 if counts are correct).

2. **Paper theme typography** — Which font pairing for the paper aesthetic (e.g. serif display + sans body)? Owner: user/plan. Block: no.

3. **Timeline with expanded UI scope** — ~3 delivery weeks; dashboard + landing + set detail. Owner: user. Block: no (shared tokens; consider phasing or +1 week).

_Resolved: landing hero copy → `landing-copy.md` variant A (user choice 2026-05-30)._

_Scope addendums (2026-05-30): landing (FR-011 / US-03); set detail paper theme (FR-012 / US-04). Review session UI remains follow-up._
