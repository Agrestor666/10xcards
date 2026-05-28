---
change_id: set-dashboard-lifecycle
title: Set dashboard lifecycle
status: implemented
created: 2026-05-28
updated: 2026-05-28
archived_at: null
---

## Notes

### FlashcardGenerator (MVP)

The dashboard list (`SetDashboardList`) updates in client state after rename/delete. The AI generator dropdown still receives `sets` from SSR on first paint — **refresh the page** to sync generator options after lifecycle changes. Intentional for this slice (see plan Phase 3).

### Manual regression checklist (Phase 3)

- [ ] Create set via HTML form on `/dashboard`
- [ ] Rename set inline → open `/sets/<id>` → header shows new name
- [ ] Delete empty set (no modal) → row removed
- [ ] Delete non-empty set → modal shows correct card count → confirm removes row
- [ ] Visit `/sets/<deleted-id>` → redirect to `/dashboard?error=Set not found`
- [ ] Card CRUD on another set (`/sets/<id>`) unchanged
- [ ] SRS review route loads
- [ ] AI generate + bulk save on dashboard still works
