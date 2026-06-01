---
project: "10xCards"
checked_at: "2026-05-28T20:25:51+01:00"
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 0
  low: 0
test_runner_detected: false
ci_provider: GitHub Actions
recommended_fixes: 4
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

### Security Audit

```
Tool: npm audit --json
Status: failed to run
Reason: Registry request failed with ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED (local npm/registry TLS on this machine). Exit code 1.
Summary: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW (not evaluated — audit did not complete)
Direct vs transitive: not available
```

Re-run when network/TLS allows: `npm audit` (or rely on GitHub Dependabot once enabled). CI does not currently run a security audit step.

### Outdated Dependencies

```
Tool: npm outdated --json
Status: failed to run
Reason: Same SSL/registry error as audit.
Packages with major version gaps: unknown
```

Re-run: `npm outdated` from a machine with working registry access, or review lockfile age in CI.

## Test Suite

```
Test runner: not detected
Tests found: 0 (no *.test.ts / *.spec.ts files)
Test execution: not attempted
```

```
⚠ No test runner detected. The agent cannot verify its own changes automatically.
Recommended: npm init vitest@latest — then add "test": "vitest run" to package.json scripts.
```

`npm run lint` completed successfully locally (ESLint with `strictTypeChecked`; benign `astro-eslint-parser` warnings about `projectService`).

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml
```

| Stage      | Status | Notes                                              |
|------------|--------|----------------------------------------------------|
| Lint       | ✓      | `npm run lint` (ESLint + typescript-eslint)        |
| Test       | ✗      | No test script; no test step                       |
| Build      | ✓      | `npm run build` with Supabase secrets              |
| Type check | ~      | Partial via ESLint type-checked rules; no `astro check` or standalone `tsc` in CI |
| Security   | ✗      | No `npm audit`, Dependabot, or CodeQL in repo      |

Additional local gates: Husky + lint-staged on commit (`eslint --fix`, Prettier).

## Configuration

### High severity

_None — TypeScript strict via `astro/tsconfigs/strict`, ESLint configured, `.gitignore` present._

### Medium severity

- **No automated tests** — Agents and CI cannot catch regressions on API routes (e.g. prd-v2 set rename/delete). Fix: add Vitest (see Recommended Fixes).

### Low severity

- **`.editorconfig`** — Missing; editors may format inconsistently across contributors. Fix: add a minimal `.editorconfig` aligned with Prettier, or document “Prettier is source of truth” in AGENTS.md (already implied by lint-staged).

All other expected files present: `.prettierrc.json`, `eslint.config.js`, `tsconfig.json`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality gate gap              | Health-check finding                                      | Status        |
|-------------------------------|-----------------------------------------------------------|---------------|
| Test runner: fail             | No test runner, no test files, CI has no test stage       | Reinforced    |
| Language / framework: pass    | Lint passes; lockfile present; CI lint + build            | Mitigated     |
| Supabase RLS (slice risk)       | AGENTS.md documents RLS; no service-role on user routes   | Mitigated     |
| Compensation blocks in AGENTS.md | Stack-assess recommended paste blocks not yet in AGENTS.md | Gap — add before prd-v2 implement |

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Add a test runner (Vitest)

**Impact:** Without tests, agents cannot verify rename/delete API behavior or RLS regressions; stack-assessment flagged this as the main friction point.

**Severity:** high  
**Effort:** moderate (15–30 min)

**Fix:**

```bash
npm init vitest@latest
```

Add to `package.json` scripts: `"test": "vitest run"`. Add at least one smoke test for an existing API route (e.g. flashcard set name validation). Then add `- run: npm test` to `.github/workflows/ci.yml`.

### 2. Paste stack-assessment compensation into AGENTS.md

**Impact:** prd-v2 (set rename/delete on dashboard) needs explicit API/UI scope rules; they exist in `stack-assessment.md` but not yet in `AGENTS.md`.

**Severity:** medium  
**Effort:** quick (< 5 min)

**Fix:** Copy the three markdown blocks from `context/foundation/stack-assessment.md` § Gaps & Compensation into `AGENTS.md` (Testing, Flashcard set API conventions, Set rename/delete UI scope).

### 3. Re-run dependency audit when registry access works

**Impact:** Unknown vulnerability count until `npm audit` succeeds.

**Severity:** medium  
**Effort:** quick (< 5 min)

**Fix:** From a working network: `npm audit`. Address any HIGH/CRITICAL before large refactors. Consider enabling Dependabot security updates on GitHub.

### 4. Optional: explicit type-check in CI

**Impact:** Catches type errors ESLint might miss on `.astro` files.

**Severity:** low  
**Effort:** quick (< 5 min)

**Fix:** Add CI step: `npx astro check` (project already depends on `@astrojs/check`).

### Addressed in upcoming lessons (Category B)

### CI security scanning

**Lesson:** Infrastructure / deployment (Sprint Zero — CI/CD hardening)  
**What you'll do there:** Add Dependabot, `npm audit` in CI, or CodeQL so security findings are continuous, not ad hoc.

### Deployment hardening

**Lesson:** Infrastructure lesson (M1L5 equivalent)  
**What you'll do there:** Wrangler deploy secrets, preview environments — `wrangler.jsonc` exists locally; production pipeline may be extended there.

_Note: `AGENTS.md` and `CLAUDE.md` already exist — agent onboarding is partially done; enrich with stack-assessment blocks rather than creating stubs from scratch._

## Summary

**Health status: needs-attention**

The project is in good shape for brownfield agent work on the core stack: pinned dependencies (`package-lock.json`), strict TypeScript, ESLint + Prettier, Husky, GitHub Actions lint/build, and solid instruction files. The main gap is **no automated test suite** — reinforced by stack-assessment — which limits how confidently an agent (or CI) can verify changes like prd-v2 set management. Dependency audit and outdated checks could not run in this environment due to npm registry SSL errors; re-run locally or in CI when possible.

**Next step:** Address fix #1 (Vitest) and #2 (AGENTS.md compensation blocks) before `/10x-plan` or `/10x-implement` for set rename/delete; then proceed with agent-assisted development using the manual checklist until tests exist.
