---
change_id: auth-turnstile
title: Cloudflare Turnstile bot protection on public auth flows
status: archived
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29T12:26:49Z
---

## Notes

Roadmap S-12 (`auth-turnstile`). Cloudflare Turnstile widget on `/auth/signin`, `/auth/signup`, and `/auth/forgot-password` (Managed mode, light theme, flexible width, localized PL/EN) plus fail-closed server-side verification via Cloudflare `siteverify` on `POST /api/auth/signin`, `POST /api/auth/signup`, and `POST /api/auth/forgot-password`. Includes `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `astro:env/server`, `/api/health`, and `missingConfigs`, with official Cloudflare dummy keys for local dev and CI E2E.
