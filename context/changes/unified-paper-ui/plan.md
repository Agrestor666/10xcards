# Unified Paper UI (S-08) Implementation Plan

## Overview

Complete the paper visual system started in S-07 (`study-hub-ui`) by migrating the remaining cosmic routes — review session, settings, and auth — to `PaperShell` + `AppTopbar` and paper-aware React components. This is a presentation-only change: no SRS, auth API, or database modifications.

## Current State Analysis

**Already paper (S-07):**

- `src/pages/dashboard.astro`, `src/components/Welcome.astro` (landing `/`), `src/pages/sets/[id]/index.astro`
- `src/components/layout/PaperShell.astro`, `src/components/layout/AppTopbar.astro`
- `.paper-theme` CSS variables in `src/styles/global.css` (lines 121–144)

**Still cosmic:**

| Route | Astro shell | React islands |
| ----- | ----------- | ------------- |
| `/sets/<id>/review` | `bg-cosmic`, `Topbar.astro`, glass header | `ReviewSession.tsx` (hardcoded white/glass) |
| `/settings` | same | `AccountDangerZone.tsx`, shadcn `Input` (cosmic defaults) |
| `/auth/signin`, `/auth/signup`, `/auth/confirm-email` | centered cosmic card | `SignInForm`, `SignUpForm` → `FormField` (cosmic inputs) |

**Legacy navigation:** `src/components/Topbar.astro` — cosmic styling; superseded by `AppTopbar.astro` on paper routes.

**Shared styling debt:** `src/components/ui/input.tsx` hardcodes `border-white/10 bg-white/5 text-white` (from account-deletion slice), so even inside `.paper-theme` inputs look cosmic until fixed.

### Key Discoveries:

- `FlashcardRow.tsx` already implements `theme: "cosmic" | "paper"` with `default "cosmic"` — reuse this pattern for auth and review (`src/components/flashcards/FlashcardRow.tsx:30–38`).
- Set detail header pattern (`border-border bg-card`, `font-display`, `text-primary` links) in `src/pages/sets/[id]/index.astro:22–37 is the template for settings/review page headers.
- S-07 regression checklist explicitly expects review/settings cosmic *behavior* unchanged (`context/changes/study-hub-ui/change.md:50–52`) — S-08 replaces that expectation with paper parity.

## Desired End State

- Every user-facing route listed in roadmap S-08 uses `PaperShell` + `AppTopbar` (or centered `PaperShell` variant for auth).
- No `import Topbar from "@/components/Topbar.astro"` in `src/pages/`.
- No `bg-cosmic` class on any page under `src/pages/` except none (utility may remain in `global.css` unused).
- React islands on those routes use `theme="paper"` or paper token classes; grading/sign-in/delete-account flows unchanged.
- Verification: `npm run lint`, `npm run build`, and manual checklist in `change.md`.

## What We're NOT Doing

- Changing SRS algorithm, `/api/srs/due`, `/api/srs/grade`, or review state machine
- Auth API or middleware changes
- Database migrations or RLS
- Polish i18n / copy rewrites beyond token-consistent styling
- New automated test suite
- Marketing pages or new features
- Removing `@utility bg-cosmic` from CSS (kept unused per decision; optional dead-code note in Phase 4)

## Implementation Approach

1. **Inventory** cosmic classes and fix shared `input.tsx` so token-based styling works under `.paper-theme`.
2. **Auth + settings** first (user-confirmed): lowest risk to SRS; validates `theme="paper"` on forms and account deletion.
3. **Review session**: Astro shell + `ReviewSession` paper branch only — no edits to `fetchDueState`, `submitRating`, or `dispatchDashboardSetReviewGraded`.
4. **Cleanup**: delete `Topbar.astro`, grep repo, append regression checklist to `change.md`.

## Critical Implementation Details

**SRS isolation:** In Phase 3, restrict edits to JSX `className` strings and Astro markup in `review.astro`. Do not modify `dueUrl`, `fetchDueState`, `submitRating`, rating types, or API payloads in `ReviewSession.tsx`.

**Theme prop contract:** Introduce `export type UiTheme = "cosmic" | "paper"` in `src/types.ts` (or colocate with first consumer) and use consistently on `FormField`, `PasswordToggle`, `ServerError`, `ReviewSession`, `AccountDangerZone`. When `theme === "paper"`, use the same token class names as `FlashcardRow` paper branch (`border-border`, `bg-card`, `text-muted-foreground`, `text-primary`, shadcn `Button` variants without cosmic overrides).

## Phase 1: Inventory and shared primitives

### Overview

Document remaining cosmic usage and fix shared input styling so later phases do not fight hardcoded white inputs.

### Changes Required:

#### 1. Cosmic inventory note

**File**: `context/changes/unified-paper-ui/change.md`

**Intent**: Append a short inventory table (route → files) from `rg "bg-cosmic|Topbar\\.astro|white/10|purple-300"` under `src/` so Phase 4 cleanup can diff against it.

**Contract**: New subsection `### Cosmic inventory (Phase 1)` under `## Notes` listing files still cosmic before Phase 2 starts.

#### 2. Restore shadcn input tokens

**File**: `src/components/ui/input.tsx`

**Intent**: Replace cosmic-specific default classes with shadcn token utilities so inputs inside `.paper-theme` pick up `--input`, `--foreground`, etc.

**Contract**: Default `className` uses `border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50` (or equivalent from shadcn new-york template). Preserve `cn()` merge and `data-slot="input"`.

#### 3. Auth helper theme support

**File**: `src/components/auth/FormField.tsx`

**Intent**: Add optional `theme?: UiTheme` (default `"cosmic"` until Phase 2 callers pass `"paper"`). Paper branch uses token classes matching `FlashcardRow` paper inputs.

**Contract**: Props include `theme?: "cosmic" | "paper"`; label, input, icon, and error colors branch on `theme === "paper"`.

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Paper branch uses `text-muted-foreground hover:bg-accent` instead of white/60 cosmic hover.

**Contract**: Accept `theme?: "cosmic" | "paper"`; pass through from `FormField` `endContent`.

**File**: `src/components/auth/ServerError.tsx`

**Intent**: Paper-friendly error surface (`border-destructive/30 bg-destructive/10 text-destructive`).

**Contract**: Optional `theme` prop; cosmic branch unchanged for backward compatibility during migration (no cosmic pages remain after Phase 4).

#### 4. Shared type (if added)

**File**: `src/types.ts`

**Intent**: Single `UiTheme` type reused by flashcards, auth, SRS, account components.

**Contract**: `export type UiTheme = "cosmic" | "paper";` — update `FlashcardRow` to import it (optional refactor, same string union).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Open `/settings` (still cosmic shell temporarily): confirm delete-account dialog input is readable after `input.tsx` change (no invisible text on white card once settings is paper in Phase 2)

**Implementation Note**: Pause for human confirmation of manual criteria before Phase 2.

---

## Phase 2: Auth and settings on paper

### Overview

Migrate settings and all auth pages to `PaperShell` / `AppTopbar`, wire `theme="paper"` through auth and account components.

### Changes Required:

#### 1. Settings page shell

**File**: `src/pages/settings.astro`

**Intent**: Match set detail layout: `PaperShell`, `AppTopbar`, paper header card, paper-styled error banner.

**Contract**: Remove `Topbar` and `bg-cosmic` imports/wrappers. Header uses `border-border bg-card`, `font-display` title, `text-muted-foreground` subtitle. Pass `theme="paper"` to `AccountDangerZone` island.

#### 2. Account danger zone paper theme

**File**: `src/components/account/AccountDangerZone.tsx`

**Intent**: Paper section card and copy colors; rely on token-based `Input` for confirm field; keep dialog and API logic identical.

**Contract**: Optional `theme?: UiTheme` (default `"paper"` when only used on settings). Section uses `border-border bg-card` for paper; destructive emphasis via `text-destructive` / `Button variant="destructive"` without `bg-red-500/80` cosmic overrides unless needed for contrast.

#### 3. Auth forms

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`

**Intent**: Pass `theme="paper"` to all `FormField`, `PasswordToggle`, `ServerError` usages; fix `SignUpForm` hint line (`text-blue-100/50` → `text-muted-foreground`).

**Contract**: No change to `validate`, `handleSubmit`, form `action`, or field names.

#### 4. Auth Astro pages

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Centered auth layout on paper background — outer `PaperShell` (full viewport, flex center), inner `border-border bg-card` card (max-w-sm), `font-display` headings, `text-primary` footer links.

**Contract**: Replace `bg-cosmic` and gradient headline classes with paper tokens. `SignInForm` / `SignUpForm` receive `client:load` unchanged. Confirm-email keeps DEV vs prod copy logic; only markup/classes change.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Logged out: `/auth/signin` and `/auth/signup` — readable fields, validation errors, successful sign-in redirect
- `/auth/confirm-email` renders in DEV and copy modes (smoke)
- Logged in: `/settings` shows email, stats, danger zone; delete-account dialog types `DELETE`, cancel works (do not complete deletion unless testing account-deletion change)
- `AppTopbar`: Settings, Sets, Sign out links work from settings
- Footer cross-links (sign up ↔ sign in) use paper link styling

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Review session on paper

### Overview

Migrate review route and `ReviewSession` UI to paper; align `FlashcardRow` default with paper-only app surface.

### Changes Required:

#### 1. Review page shell

**File**: `src/pages/sets/[id]/review.astro`

**Intent**: Same structure as `sets/[id]/index.astro`: `PaperShell`, `AppTopbar`, paper header with back link to set.

**Contract**: Remove `Topbar` and `bg-cosmic`. Back link: `text-primary` to `/sets/${setMeta.id}`. Title uses `font-display`. `ReviewSession` receives `theme="paper"` prop.

#### 2. Review session presentation

**File**: `src/components/srs/ReviewSession.tsx`

**Intent**: Add `theme?: UiTheme`; paper branch swaps glass classes for `border-border bg-card text-foreground` patterns; grade buttons use semantic colors on paper (e.g. destructive/muted/primary variants) without changing handlers.

**Contract**: Props: `theme?: "cosmic" | "paper"` default `"paper"` after migration. **Do not modify** `fetchDueState`, `submitRating`, `loadNext`, `dispatchDashboardSetReviewGraded`, or fetch URLs/bodies. Empty-state link uses `text-primary` not `text-purple-300`.

#### 3. Flashcard row default

**File**: `src/components/flashcards/FlashcardRow.tsx`

**Intent**: Default `theme` to `"paper"` now that no cosmic page hosts flashcard rows.

**Contract**: `theme = "paper"` in destructuring default; cosmic branch remains for safety until Phase 4 grep confirms zero `theme="cosmic"` callers.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Dashboard → **Study** → review: paper shell, show answer, grade **Again/Good**, card advances
- Return dashboard: due counts decrease (dashboard-set-sync)
- Empty due state: message + back link to set
- Set detail → **Start review**: same paper session
- No console errors on fetch/grade failures (retry button still works)

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Legacy cleanup and regression

### Overview

Remove obsolete cosmic topbar, verify no user route references cosmic shell, finalize change documentation.

### Changes Required:

#### 1. Delete legacy topbar

**File**: `src/components/Topbar.astro`

**Intent**: Remove file once grep shows zero imports.

**Contract**: File deleted; no remaining `@/components/Topbar.astro` imports in `src/`.

#### 2. Repo-wide cosmic grep

**Intent**: Confirm `bg-cosmic` does not appear in `src/pages/**`. Document any intentional exceptions (e.g. none expected).

**Contract**: Inventory note in `change.md` updated to “all clear” or lists stragglers with owner.

#### 3. Regression checklist

**File**: `context/changes/unified-paper-ui/change.md`

**Intent**: Add manual regression checklist (mirroring S-07 structure) covering full navigation loop and SRS/auth smoke.

**Contract**: Checklist sections: **Paper continuity**, **Auth**, **Settings / account**, **Review SRS**, **Out of scope / preserved APIs**.

#### 4. Optional comment on unused utility

**File**: `src/styles/global.css`

**Intent**: One-line comment above `@utility bg-cosmic` that it is retained for optional dev/marketing use, not user app routes.

**Contract**: Comment only; do not remove utility per plan decision.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `rg "Topbar\\.astro" src/` returns no matches
- `rg "bg-cosmic" src/pages` returns no matches

#### Manual Verification:

- Full loop: `/` → sign up/in → dashboard → set → review → settings → sign out → `/` (all paper, no cosmic flash)
- S-07 dashboard behaviors still work: due hero, Study, new set, ⋯ menu, generator collapse
- Account deletion dialog usable on paper settings (smoke)

**Implementation Note**: Pause for final human sign-off before `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- None in repository; no new test files this slice.

### Integration Tests:

- None; manual smoke only.

### Manual Testing Steps:

1. Run Phase-specific manual criteria above in order.
2. Test on mobile-width viewport: auth card and review grade grid do not overflow.
3. Second-account RLS smoke optional (same as S-07 checklist).

## Performance Considerations

- No meaningful performance impact; className changes only.
- Font assets already loaded via S-07 `paper-fonts.css` on `PaperShell`.

## Migration Notes

- No data migration.
- Deploy is safe as CSS/markup-only; rollback is revert commit.
- S-07 `change.md` “out of scope” note (review/settings cosmic) is superseded once S-08 ships — update S-08 checklist instead of editing archived S-07 unless archiving together.

## References

- Roadmap S-08: `context/foundation/roadmap.md` (lines 197–211)
- S-07 plan: `context/changes/study-hub-ui/plan.md`
- Paper shell: `src/components/layout/PaperShell.astro`
- Dual theme pattern: `src/components/flashcards/FlashcardRow.tsx`
- PRD NFR: `context/foundation/prd-v3.md` (paper shell, not cosmic)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Inventory and shared primitives

#### Automated

- [x] 1.1 `npm run lint` passes — 46eb88d
- [x] 1.2 `npm run build` passes — 46eb88d

#### Manual

- [x] 1.3 Settings delete dialog input readable after input.tsx token fix (smoke) — 46eb88d

### Phase 2: Auth and settings on paper

#### Automated

- [x] 2.1 `npm run lint` passes — ef888a6
- [x] 2.2 `npm run build` passes — ef888a6

#### Manual

- [x] 2.3 Auth sign-in and sign-up flows on paper (fields, errors, redirect) — ef888a6
- [x] 2.4 Settings page and AppTopbar navigation on paper — ef888a6
- [x] 2.5 Account deletion dialog opens and confirm field works (cancel without delete) — ef888a6

### Phase 3: Review session on paper

#### Automated

- [x] 3.1 `npm run lint` passes — 931cbd4
- [x] 3.2 `npm run build` passes — 931cbd4

#### Manual

- [x] 3.3 Study → review → grade flow on paper with dashboard due sync — 931cbd4
- [x] 3.4 Empty due state and back link on paper — 931cbd4

### Phase 4: Legacy cleanup and regression

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm run build` passes
- [x] 4.3 No `Topbar.astro` imports under `src/`
- [x] 4.4 No `bg-cosmic` under `src/pages/`

#### Manual

- [x] 4.5 Full navigation loop paper continuity (landing, auth, dashboard, set, review, settings)
- [x] 4.6 S-07 dashboard features regression smoke
