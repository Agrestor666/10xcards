---
project: "10xCards"
version: 2
status: draft
created: 2026-05-28
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

**Core functionality today:**
- Create and list named flashcard sets from the dashboard
- Open a set to add, edit, and delete individual flashcards
- Generate flashcards with AI and save them to a set
- Run spaced-repetition review sessions per set
- Datastore already supports updating set names and deleting sets for the owner; the application exposes create and list only — no rename or delete in the UI

## Problem Statement & Motivation

**Gap:** A logged-in user can create sets and manage flashcards inside a set, but cannot fix a misleading set name or remove a set they no longer want — whether the set is empty or contains cards. Typos, test sets after AI generation, and abandoned subjects stay on the dashboard with no cleanup path.

**Why now:** Set lifecycle is incomplete at the list level; users hit friction on every housekeeping task that competitors solve with basic collection management.

**Current workaround:** Leave unwanted sets on the list or work around bad names — no product-supported fix.

**Insight:** Owner-scoped update and delete are already permitted at the data layer; exposing them in the dashboard list is a small delivery with high UX payoff.

## User & Persona

**Persona (unchanged):** Indywidualny learner — student, profesjonalista, samouk.

**Moment:** On the dashboard they scan their set list and want to delete a set they no longer need or rename another to fix a typo or misleading title — without workarounds.

**Delta:** Today they can only create and open sets; after this change they can rename and delete from the same list.

## Success Criteria

### Primary

- A logged-in user can delete an unwanted set and rename another set with a misleading name from the dashboard — both flows work end-to-end without workarounds.

### Secondary

- When deleting a non-empty set, the user sees how many flashcards will be removed before confirming; an empty set is removed in one action without an extra confirmation step.

### Guardrails

- Only the set owner can rename or delete a set — no regression in access boundaries (another user cannot touch someone else's sets).
- Creating sets, listing sets, card CRUD inside a set, SRS review, and AI generation continue to behave as before.

## User Stories

### US-01: User removes an unwanted set and fixes a misleading set name from the dashboard

- **Given** a logged-in user on the dashboard with at least two flashcard sets
- **When** they delete a set they no longer want (confirming first if it contains cards) and edit another set's name to fix a typo or misleading title
- **Then** the deleted set no longer appears in the list, the renamed set shows the new name, and opening the renamed set still works

**Before:** Delete and rename were not available from the dashboard.

#### Acceptance Criteria

- Empty sets delete without confirmation; non-empty sets require confirmation showing card count
- Rename validates name length (same rules as create: 1–80 characters)
- Only the set owner can perform rename or delete
- After delete, the deleted set's detail page is not reachable (redirect to dashboard or not-found)

## Scope of Change

### New

- [new] User can edit a flashcard set name from the dashboard.
  > Socrates: No counter-argument; rename on the dashboard matches the user's cleanup workflow. Stands as written.
- [new] User can delete an empty flashcard set from the dashboard without confirmation.
  > Socrates: Counter-argument considered: "empty sets should still require confirmation for consistency." Resolution: dropped confirmation for empty sets — faster cleanup; non-empty sets keep confirmation.
- [new] User can delete a flashcard set that contains cards from the dashboard; confirmation shows how many cards will be removed.
  > Socrates: Counter-argument considered: "recoverable trash is safer than permanent delete." Resolution: kept permanent delete with explicit card count — keeps delivery small.

### Preserved

- [preserved] User can create a named flashcard set.
- [preserved] User can browse all their flashcard sets on the dashboard.
- [preserved] User can create, edit, and delete flashcards within a set.
- [preserved] User can start a spaced-repetition review session for a selected set.
- [preserved] User can generate flashcards with AI and save them to a set.

## Constraints & Compatibility

- **Access:** Only the set owner can rename or delete; same owner-only rules as today.
- **Data:** Deleting a set removes all flashcards that belonged to it; no flashcards remain associated with that set afterward.
- **Validation:** Renamed set names use the same rules as create (1–80 characters).
- **Navigation:** A deleted set's detail URL must not show stale content (redirect to dashboard or not-found).
- **Preserved flows:** Create/list sets on dashboard, card CRUD on set detail, SRS review, AI generator — no intentional behavior change beyond rename/delete on the dashboard.
- **Backward compatibility:** No intentional breaking changes to existing card, review, or generator behavior.

## Business Logic Changes

No domain logic change. This change exposes existing set lifecycle operations (update name, delete set and its cards) in the product UI. Spaced-repetition scheduling and AI extraction rules are unchanged.

## Access Control Changes

No access control changes — current model preserved. Email/password registration, flat roles, and private sets per owner remain as today. Rename and delete are available only to the set owner under the same rules as other set operations.

## Non-Goals

- **No rename/delete on the set detail page** — set name edit and delete actions live on the dashboard list only in this change.
- **No recoverable trash / restore** — delete is immediate; removed sets and their cards are not recoverable in-product.
- **No bulk delete** — one set at a time; no multi-select or "delete all empty sets."

## Open Questions

_None — shape input was complete (quality cross-check: accepted)._
