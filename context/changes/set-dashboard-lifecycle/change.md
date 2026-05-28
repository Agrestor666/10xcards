---
change_id: set-dashboard-lifecycle
title: Set dashboard lifecycle
status: impl_reviewed
created: 2026-05-28
updated: 2026-05-28
archived_at: null
---

## Notes

### FlashcardGenerator (MVP)

The dashboard list (`SetDashboardList`) updates in client state after rename/delete. The AI generator dropdown still receives `sets` from SSR on first paint — **refresh the page** to sync generator options after lifecycle changes. Intentional for this slice (see plan Phase 3).

### Stale card count (MVP)

`card_count` on the dashboard list is also an SSR snapshot. If you add or remove cards on `/sets/<id>` and return to the dashboard **without reloading**, the delete modal may show the wrong count (e.g. skip modal when cards were added elsewhere). Cascade delete at the DB level still removes all cards — refresh the dashboard to sync counts before delete.

### Manual regression checklist (Phase 3)

- [ ] Create set via HTML form on `/dashboard`
- [ ] Rename set inline → open `/sets/<id>` → header shows new name
- [ ] Delete empty set (no modal) → row removed
- [ ] Delete non-empty set → modal shows correct card count → confirm removes row
- [ ] Visit `/sets/<deleted-id>` → redirect to `/dashboard?error=Set not found`
- [ ] Card CRUD on another set (`/sets/<id>`) unchanged
- [ ] SRS review route loads
- [ ] AI generate + bulk save on dashboard still works
