# Study hub UI (S-07) Implementation Plan

## Overview

Redesign the product shell around a **study-first dashboard**: show cards due today, set tiles with **Study** / **⋯** actions, paper-notes visual identity on `/dashboard`, `/`, and `/sets/<id>`, and landing copy from `landing-copy.md` (variant A). No database migrations, no SRS algorithm changes, no auth changes.

## Current State Analysis

- **Dashboard** (`src/pages/dashboard.astro`): `bg-cosmic`, header “Your sets”, full-width HTML create form → `POST /api/flashcard-sets/create`, `FlashcardGenerator` (`client:load`), `SetDashboardList` row UI with inline Edit/Delete.
- **SSR data:** `flashcard_sets` + `flashcards(count)` → `DashboardSetRow` with `card_count` only (`src/types.ts:23-25`). No `due_count`.
- **Due semantics:** `GET /api/srs/due` filters `due_at <= nowIso` (`src/pages/api/srs/due.ts:55-63`). Review UI consumes this API client-side.
- **Cross-island sync:** `DASHBOARD_SET_CARDS_ADDED` updates `card_count` in `SetDashboardList.tsx:59-78`; generator dispatches from `FlashcardGenerator.tsx`.
- **Landing:** `Welcome.astro` — “10x Astro Starter”, cosmic orbs, starter feature cards.
- **Set detail:** `sets/[id]/index.astro` — cosmic shell, **Start review** → `/sets/<id>/review`, `SetFlashcardsManager` island.
- **Layout default title:** `"10x Astro Starter"` (`src/layouts/Layout.astro:10`).
- **shadcn UI installed:** `button`, `input`, `alert-dialog` only — no `dropdown-menu` or `dialog` yet.
- **No test runner** — lint + build + manual regression.

## Desired End State

1. **`/dashboard`:** Paper shell; hero “**N cards due today**” (or friendly empty); responsive **tile grid** with set name, card count, due count, primary **Study** → `/sets/<id>/review`, **⋯** → Rename / Delete (same rules as today); **+ New set** tile opens dialog → existing create API; AI generator in collapsed `<details>`.
2. **`/`:** Variant A hero + 3 feature cards; **Get started** / **Sign in**; `Layout` title from `landing-copy.md`.
3. **`/sets/<id>`:** Paper shell; preserved CRUD + **Start review**; no functional API changes.
4. **Guardrails:** `dashboard-set-sync` still updates counts after AI save; rename/delete confirmation unchanged; RLS unchanged.

Verification: manual checklist in Phase 4; `npm run lint`; `npm run build`.

### Key Discoveries:

- Due counts for dashboard SSR should use the **same** `nowIso` + `.lte("due_at", nowIso)` filter as `srs/due.ts` — do not invent a different “today” boundary.
- PostgREST nested `flashcards(count)` cannot filter by `due_at` without a view/RPC; **second query** + TS aggregate is the simplest no-migration approach.
- Shape requires **⋯ menu** rename/delete — current inline Edit/Delete in `SetDashboardList.tsx` must be refactored, not skinned.
- `settings.astro` and `review.astro` remain `bg-cosmic` this slice (explicit non-goal) — expect one visual hop when entering review.

## What We're NOT Doing

- Redesign `/sets/<id>/review` or SRS grading UI.
- Paper theme on `/settings`, `/auth/*` (optional follow-up).
- Polish i18n.
- DB migrations, RPC, or materialized due columns.
- Fix generator set-picker stale name after rename (known S-05 limitation).
- Vitest / new CI stages.
- Remove `bg-cosmic` utility globally (may remain for out-of-scope pages).

## Implementation Approach

1. **Foundation:** Paper CSS variables in `global.css`, font imports, `PaperShell.astro` + `AppTopbar.astro` (10xCards brand, nav links).
2. **Data layer:** `load-dashboard-sets.ts` returns sets with `card_count` + `due_count` + `total_due`.
3. **Dashboard:** Restructure `dashboard.astro`; replace list with `SetDashboardGrid.tsx` (tiles, Study, dropdown); `NewSetDialog.tsx`; wrap generator in `<details>`.
4. **Surface pages:** Rebuild `Welcome.astro`; migrate `sets/[id]/index.astro` to paper shell.
5. **Regression:** Extend `change.md` checklist; verify due counts vs review session.

## Critical Implementation Details

**Due count query:** After loading sets with `flashcards(count)`, run:

```ts
const nowIso = new Date().toISOString();
const { data: dueRows } = await supabase
  .from("flashcards")
  .select("set_id")
  .lte("due_at", nowIso);
// Reduce to Map<setId, number>; merge into each DashboardSetRow.due_count
// total_due = sum of map values (or dueRows.length)
```

RLS limits rows to the current user’s cards. Empty sets contribute 0.

**After AI bulk save:** New cards typically have `due_at` at or before now. Either extend `DashboardSetCardsAddedDetail` with optional `dueAddedCount` (same as `addedCount` when defaults apply) or document that user refreshes for due hero — prefer extending the event so hero/tiles stay accurate without reload.

**Create set:** Keep `POST` form to `/api/flashcard-sets/create` (redirect on success). On success, user lands back on dashboard with new set in SSR list — acceptable; alternatively add JSON create API later (out of scope).

## Phase 1: Paper theme foundation

### Overview

Shared visual tokens, typography, and layout shell used by dashboard, landing, and set detail.

### Changes Required:

#### 1. Paper theme tokens and fonts

**File**: `src/styles/global.css`

**Intent**: Add paper palette and map to shadcn semantic tokens for light “notes” UI on study surfaces.

**Contract**:
- Add CSS variables under `:root` (or `.paper-theme`): warm background (~`oklch(0.98 0.01 90)`), ink foreground, subtle border, accent for primary actions (e.g. deep green or warm brown — readable on off-white).
- Add `@utility bg-paper` (or use `bg-background` after overriding `--background` on `.paper-theme`).
- Import fonts: `@fontsource/dm-sans` (400, 500, 600) and `@fontsource/instrument-serif` (400, 600) — add packages in `package.json` if not present.

**File**: `package.json`

**Intent**: Font dependencies for SSR-safe self-hosted fonts.

**Contract**: `@fontsource/dm-sans`, `@fontsource/instrument-serif` in dependencies; import in `global.css`.

**Addendum (2026-05-30, impl-review F1):** Phase 1 shipped with Google Fonts `@import` in `global.css` instead of `@fontsource` (local `npm install` SSL failure). Acceptable for MVP; migrate to self-hosted `@fontsource` in a follow-up when install works.

#### 2. Paper layout shell

**File**: `src/components/layout/PaperShell.astro`

**Intent**: Reusable page wrapper replacing per-page `bg-cosmic` blocks for in-scope routes.

**Contract**:
- Props: optional `class` for inner width (`max-w-3xl` / `max-w-4xl`).
- Root: `class="paper-theme min-h-screen bg-background text-foreground"` (or explicit `bg-paper`).
- Slot for page content; consistent horizontal padding.

#### 3. App topbar

**File**: `src/components/layout/AppTopbar.astro`

**Intent**: Replace cosmic `Topbar.astro` styling on paper pages; show **10xCards** brand for guests.

**Contract**:
- Logged in: brand links to `/dashboard`; links **Sets** (`/dashboard`), **Settings**, sign-out form (same endpoints as `Topbar.astro`).
- Guest: **Sign in** / **Sign up** (landing).
- Paper-appropriate borders/colors using `cn()` and semantic tokens — no `border-white/10` glass.

**File**: `src/components/Topbar.astro`

**Intent**: Either deprecate on paper routes (use `AppTopbar` only) or make thin re-export — plan: **use `AppTopbar` on dashboard, Welcome, set detail**; leave old `Topbar` on settings/review/auth until follow-up.

#### 4. Layout default title

**File**: `src/layouts/Layout.astro`

**Intent**: Stop defaulting to starter name.

**Contract**: Default `title` prop → `"10xCards"` (pages pass explicit titles).

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- A throwaway page or Phase 2 dashboard shows paper background, readable body text, serif display on `h1`.

**Implementation Note**: Complete Phase 1 before retiling dashboard — tokens must exist first.

---

## Phase 2: Dashboard study hub

### Overview

SSR due counts, study hero, tile grid, contextual set menu, collapsed generator, preserved APIs and sync.

### Changes Required:

#### 1. Types and loader

**File**: `src/types.ts`

**Intent**: Extend dashboard row for due display.

**Contract**:
```ts
export type DashboardSetRow = Pick<FlashcardSet, "id" | "name" | "created_at" | "updated_at"> & {
  card_count: number;
  due_count: number;
};
```

**File**: `src/lib/load-dashboard-sets.ts`

**Intent**: Single SSR helper for dashboard (and tests readability).

**Contract**:
- Export `loadDashboardSets(headers, cookies)` → `{ sets: DashboardSetRow[]; totalDue: number; error: string | null }`
- Reuse existing sets query pattern from `dashboard.astro:23-48`
- Second query for due rows; merge counts; sort sets by `updated_at` desc unchanged
- On Supabase missing, return error message consistent with `SUPABASE_NOT_CONFIGURED_MESSAGE`

#### 2. Dashboard page structure

**File**: `src/pages/dashboard.astro`

**Intent**: Study-first layout with paper shell.

**Contract**:
- Import `PaperShell`, `AppTopbar`, `loadDashboardSets`
- Remove standalone create `<section>` form
- Sections order:
  1. Compact greeting (email optional, secondary)
  2. **Study hero** — if `totalDue > 0`: “{totalDue} card(s) due today”; if 0 sets: prompt create; if sets but 0 due: “You’re all caught up” + optional next-review hint (omit hint if no easy SSR data)
  3. **Set grid** — `SetDashboardGrid client:load`
  4. **AI generator** — `<details>` default `closed`, summary “Generate flashcards with AI”
- `Layout title="Dashboard"` or `"Your sets"`

#### 3. Set tile grid (replaces list)

**File**: `src/components/dashboard/SetDashboardGrid.tsx` (new; migrate logic from `SetDashboardList.tsx`)

**Intent**: Tile layout with Study, ⋯ menu, rename/delete, card sync listener.

**Contract**:
- Props: `initialSets: DashboardSetRow[]`
- Grid: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- Each tile: set name (link to `/sets/{id}`), `{card_count} cards · {due_count} due`, primary **Study** button → `/sets/{id}/review`, **⋯** `DropdownMenu` with Rename (inline dialog or prompt), Delete (existing `AlertDialog` + `delete` API)
- **+ New set** tile at end → opens `NewSetDialog`
- Preserve: `validateSetName`, `fetch` update/delete, empty-set delete without dialog, `DASHBOARD_SET_CARDS_ADDED` listener updating `card_count` and `due_count` when event carries due delta
- Remove row-based inline Edit/Delete buttons from UX (logic reused in menu)

**File**: `src/components/sets/SetDashboardList.tsx`

**Intent**: Remove or re-export from grid to avoid duplicate — **delete file** after grid ships and update imports.

#### 4. New set dialog

**File**: `src/components/dashboard/NewSetDialog.tsx`

**Intent**: Create set without dominant page form.

**Contract**:
- shadcn `Dialog` with form `method="POST" action="/api/flashcard-sets/create"` OR `fetch` + redirect — prefer native form POST for parity with `create.ts`
- Input `name`, maxlength 80, required; helper text 1–80 chars
- Trigger from + tile and empty state CTA

#### 5. shadcn components

**Command** (document in plan, run during implement):

```bash
npx shadcn@latest add dropdown-menu dialog
```

**Intent**: ⋯ menu and new-set modal.

#### 6. Dashboard set sync

**File**: `src/lib/dashboard-set-sync.ts`

**Intent**: Optional due count bump when cards saved.

**Contract**:
- Extend `DashboardSetCardsAddedDetail` with optional `dueAddedCount?: number` (default `addedCount` if all new cards due now)
- `dispatchDashboardSetCardsAdded` passes through
- `FlashcardGenerator.tsx` dispatches after successful bulk create

#### 7. Generator styling

**File**: `src/components/generator/FlashcardGenerator.tsx`

**Intent**: Paper-compatible classes inside `<details>` on dashboard.

**Contract**:
- Replace hardcoded `border-white/10` / purple glass classes with semantic `border-border`, `bg-card`, `text-foreground` where touched in this change (minimal diff — only classes needed for readability on paper).

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- Dashboard shows aggregate due + per-tile due; counts match opening review for a set with known due cards
- **Study** opens review and shows due card when expected
- **+ New set** creates set; **⋯** rename/delete match S-05 behavior
- AI generate + save updates tile counts without full reload
- Generator collapsed by default; expands and works
- Mobile: tiles stack; Study and ⋯ usable

**Implementation Note**: Pause for human verification before Phase 3.

---

## Phase 3: Landing and set detail

### Overview

Apply paper shell and copy to public landing and set detail page.

### Changes Required:

#### 1. Landing rebrand

**File**: `src/components/Welcome.astro`

**Intent**: 10xCards variant A + paper layout; remove cosmic orbs/starter copy.

**Contract**:
- Wrap in `PaperShell` + `AppTopbar` (guest nav)
- `h1`: “Flashcards from your text. Reviews on autopilot.”
- Subhead and CTAs per `landing-copy.md`
- 3 feature cards with copy from `landing-copy.md` (paper card style, no glass)
- Remove starter feature text and gradient hero

**File**: `src/pages/index.astro`

**Intent**: Pass `Layout title` from `landing-copy.md` page title.

**Contract**: `title="10xCards — AI flashcards with spaced repetition"`

#### 2. Set detail paper shell

**File**: `src/pages/sets/[id]/index.astro`

**Intent**: Align set management page with paper theme.

**Contract**:
- Replace `bg-cosmic` wrapper with `PaperShell` + `AppTopbar`
- Header: set name (serif), back link “← Dashboard” to `/dashboard`
- **Start review** as primary button (semantic primary colors, not `bg-purple-500/60`)
- Keep `SetFlashcardsManager client:load` props unchanged
- Error banner styles: paper-compatible destructive/muted

**File**: `src/components/flashcards/SetFlashcardsManager.tsx` (if needed)

**Intent**: Adjust only class names required for contrast on paper background (scoped minimal diff).

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- `/` shows variant A copy; Sign in / Sign up work
- Set detail readable on paper; **Start review** and card CRUD work
- Navigate dashboard → set → review: functional (review may look cosmic)

---

## Phase 4: Regression and docs

### Overview

Document verification and update change metadata.

### Changes Required:

#### 1. Regression checklist

**File**: `context/changes/study-hub-ui/change.md`

**Intent**: Manual test list for implementer/reviewer.

**Contract**: Add checklist sections:
- Due hero + tile counts vs review session
- Study CTA per set
- Create / rename / delete via ⋯
- AI save sync (card + due if applicable)
- Landing CTAs
- Set detail CRUD + review link
- Settings/sign out from dashboard
- Unrelated user isolation (smoke if possible)

#### 2. Change status

**File**: `context/changes/study-hub-ui/change.md`

**Contract**: `status: planned` → set to `implementing` when `/10x-implement` starts (plan leaves `planned`).

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- All checklist items ticked
- No regressions on account deletion / auth flows from dashboard topbar

---

## Testing Strategy

### Unit Tests

None in repo — skip.

### Integration Tests

None — skip.

### Manual Testing Steps

1. Create 2 sets; add cards (manual + AI); verify due counts on dashboard.
2. Complete review grade; return to dashboard — due count decreases.
3. Rename/delete via ⋯; confirm dialogs and list updates.
4. Visit `/` logged out — copy and CTAs.
5. Open set detail — paper theme; add/edit/delete card.
6. Sign out / settings from `AppTopbar`.

## Performance Considerations

- Dashboard adds one extra query (`flashcards` due rows). Acceptable for medium user scale; only `set_id` selected.
- Tile grid is client island — SSR provides initial `initialSets` for first paint (hero + counts from Astro, tiles hydrated).

## Migration Notes

No data migration. Deploy is UI-only.

## References

- PRD: `context/foundation/prd-v3.md`
- Shape: `context/foundation/shape-notes.md`
- Copy: `context/changes/study-hub-ui/landing-copy.md`
- Proposal: `context/foundation/dashboard-redesign-proposal.md`
- Due API: `src/pages/api/srs/due.ts`
- Prior UI patterns: `src/components/sets/SetDashboardList.tsx`, `src/lib/dashboard-set-sync.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Paper theme foundation

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 03517ad
- [x] 1.2 Build passes: `npm run build` — 03517ad
- [x] 1.3 Paper shell shows readable typography and off-white background on a test route or early dashboard wiring — 03517ad

### Phase 2: Dashboard study hub

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [x] 2.3 Due hero and per-tile due counts match review session for at least one set
- [x] 2.4 Study, + New set, ⋯ rename/delete, and AI save sync work without regression

### Phase 3: Landing and set detail

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Landing variant A copy and CTAs verified
- [ ] 3.4 Set detail paper theme with CRUD and Start review verified

### Phase 4: Regression and docs

#### Automated

- [ ] 4.1 Lint passes: `npm run lint`
- [ ] 4.2 Build passes: `npm run build`

#### Manual

- [ ] 4.3 Full regression checklist in `change.md` completed
