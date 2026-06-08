# App icon & favicon (S-10) — Plan Brief

> Full plan: `context/changes/app-icon-favicon/plan.md`

## What & Why

10xCards has no favicon in `public/` despite `Layout.astro` referencing one — tabs show a generic missing icon. S-10 adds an agent-generated icon matching the paper theme so users see a consistent brand mark in the browser tab and when pinning the app to their home screen.

## Starting Point

`Layout.astro` links to `/favicon.png` but `public/` is empty (no icon files). Branding in the UI is text-only ("10xCards" in topbar). Paper theme colors and fonts are finalized in S-08 (`global.css` `.paper-theme`).

## Desired End State

Stacked-flashcard icon on warm paper + green accent, exported as `favicon.png`, `favicon.ico`, and `apple-touch-icon.png` in `public/`. `Layout.astro` declares all icon links plus `site.webmanifest` with `theme_color`. Favicon readable at 32×32; touch icon crisp at 180×180.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Complexity | Minimal 2-phase plan | Static assets only; no app logic | Plan |
| Icon motif | Stacked flashcards | Matches product; legible without text at small sizes | Plan |
| Asset set | PNG + ICO + apple-touch | Covers modern browsers and legacy ICO requests | Plan |
| Web manifest | Yes (minimal) | `theme_color` + icons for install hints; no service worker | Plan |
| Generation timing | Phase 1 of implement | Agent generates variants, human approves before wiring head | Plan |
| Topbar logo | Unchanged (text) | Roadmap non-goal; favicon-only scope | Roadmap |

## Scope

**In scope:**
- Agent-generated icon (2–3 variants, pick winner)
- `public/favicon.png`, `favicon.ico`, `apple-touch-icon.png`
- `public/site.webmanifest`
- `Layout.astro` head links + optional `theme-color` meta

**Out of scope:**
- PWA service worker, 192/512 icon suite
- Topbar logo image, animated favicon
- Dark-mode alternate icons

## Architecture / Approach

```
Phase 1: Generate 512px master → downscale → public/{favicon.png, favicon.ico, apple-touch-icon.png}
Phase 2: Layout.astro <head> links + site.webmanifest (theme_color #3d6b52, bg #faf8f4)
```

Astro serves `public/` at `/`; Cloudflare Worker static assets pick up files on deploy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Generate assets | AI icon + 3 exported files in `public/` | 32×32 illegible if design too detailed |
| 2. Wire metadata | `Layout.astro` + `site.webmanifest` | Browser favicon cache (minor) |

**Prerequisites:** S-08 done (paper theme locked). No secrets or DB changes.

**Estimated effort:** ~1 short session (2 phases).

## Open Risks & Assumptions

- Fine detail in generated art may blur at 16×16 — mitigate by simplifying before export.
- `.ico` conversion requires a one-off tool (ImageMagick/sharp); not in npm scripts today.
- `theme_color` hex is an approximation of OKLCH primary — close enough for browser chrome.

## Success Criteria (Summary)

- Favicon visible in browser tab on all routes.
- Touch icon works for add-to-homescreen.
- Manifest validates in DevTools with correct theme and icons.
- Visual match to paper theme (warm paper + green), not cosmic legacy.
