---
change_id: testing-auth-ownership-boundaries
title: Auth and ownership boundary tests (API + E2E smoke)
status: new
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

Rollout Phase 2 from @context/foundation/test-plan.md — protected routes reject unauthenticated callers; cross-user CRUD blocked; 1 E2E Playwright smoke (guest `/dashboard` → `/auth/signin`). Risks #2, #5. Test types: API integration + E2E smoke.
