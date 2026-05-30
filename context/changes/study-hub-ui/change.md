---
change_id: study-hub-ui
title: Study hub ui
status: impl_reviewed
created: 2026-05-29
updated: 2026-05-30
phase1_reverified: 2026-05-29
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

S-07 from `context/foundation/roadmap.md`. PRD: `context/foundation/prd-v3.md`. Shape input: `context/foundation/shape-notes.md`, `context/foundation/dashboard-redesign-proposal.md`.

**Scope addendum (2026-05-30):**

1. Landing rebrand (`/` → `Welcome.astro`) — 10xCards + paper theme.
2. Set detail (`/sets/<id>`) — same paper theme tokens; CRUD + Start review preserved.
3. Hero copy: `landing-copy.md` **variant A** — “Flashcards from your text. Reviews on autopilot.” Review session UI styling still out of slice.

### Manual regression checklist (Phase 4)

Run end-to-end before archive or release. Tick when verified.

**Dashboard study hub**

- [x] Due hero total matches sum of per-tile due counts (or both zero)
- [x] For a set with known due cards: tile `due` count matches cards shown when opening **Study** → review session
- [x] After grading in review: return to dashboard — hero and tile due counts decrease as expected
- [x] **Study** on a tile opens `/sets/<id>/review` and shows due cards when expected
- [x] **+ New set** tile opens dialog; create succeeds and new set appears in grid
- [x] **⋯** rename updates tile name; **⋯** delete matches S-05 (empty = no modal, non-empty = confirm with count)
- [x] AI generate + bulk save updates tile `card_count` and `due_count` without full page reload
- [x] Generator `<details>` collapsed by default; expands and works on paper background

**Landing and set detail**

- [x] Logged out `/`: variant A headline, subhead, 3 feature cards, **Get started** → signup, **Sign in** → signin
- [x] `/sets/<id>`: paper shell, **← Dashboard**, **Start review**, card add/edit/delete work
- [x] Navigate dashboard → set detail → review: functional (review UI may still be cosmic)

**Topbar and auth (smoke)**

- [x] From dashboard: **Settings** loads; sign-out returns to public home or sign-in
- [x] Account deletion flow unchanged if tested separately (see `account-deletion` change)
- [x] **Unrelated user** (second account, if available): cannot see or mutate first user’s sets

**Out of scope (expected)**

- [x] `/sets/<id>/review` and `/settings` still use cosmic theme — no regression in behavior
