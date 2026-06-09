---
change_id: ci-quality-gate
title: Add CI quality gate so npm test blocks merge
status: archived
created: 2026-06-08
updated: 2026-06-09
archived_at: 2026-06-09T09:16:19Z
---

## Notes

quality gate from @context/foundation/test-plan.md

**Merge order:** `testing-bootstrap-srs-scheduling` (Vitest + `npm test` script) must merge before this change — otherwise CI fails with "Missing script: test". CI step order: `lint` → `test` → `build`.
