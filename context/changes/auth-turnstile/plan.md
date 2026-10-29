# Auth Turnstile Bot Protection Implementation Plan

## Overview

Protect the three public authentication flows — sign-in (`/auth/signin`), sign-up (`/auth/signup`), and password-reset request (`/auth/forgot-password`) — with Cloudflare Turnstile so automated bots cannot brute-force credentials, mass-register accounts, or flood inboxes with recovery emails. Verification runs server-side in Astro API routes (`POST /api/auth/signin`, `POST /api/auth/signup`, `POST /api/auth/forgot-password`) via Cloudflare's `siteverify` API before invoking Supabase Auth, while the React form islands render a Paper-themed, localized (PL/EN) Turnstile widget and validate token presence inline before submission.

## Current State Analysis

- **Auth Pages & React Forms**:
  - `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, and `src/pages/auth/forgot-password.astro` render `SignInForm`, `SignUpForm`, and `ForgotPasswordForm` (`client:load`) inside a `max-w-sm` Paper card and pass `locale` and `serverError` (resolved via `resolveAuthErrorMessage` in `src/lib/auth-errors.ts:79-89`).
  - `src/components/auth/SignInForm.tsx:56`, `src/components/auth/SignUpForm.tsx:92`, and `src/components/auth/ForgotPasswordForm.tsx:46` submit via native HTML `<form method="POST">` (`application/x-www-form-urlencoded`) after synchronous client-side validation in `handleSubmit`.
- **Auth API Endpoints**:
  - `src/pages/api/auth/signin.ts:5-31`, `src/pages/api/auth/signup.ts:4-32`, and `src/pages/api/auth/forgot-password.ts:4-24` read `context.request.formData()`, call `context.locals.supabase.auth.*`, and redirect with `?error=<AuthErrorKey>` on failure. None of these routes verify a CAPTCHA or Turnstile token today.
- **Environment & Readiness Checks**:
  - `astro.config.mjs:17-24` declares `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY` as `envField.string({ context: "server", access: "secret", optional: true })`.
  - `src/pages/api/health.ts:11-18` checks all four secrets and returns HTTP 200 `{ ok: true }` or HTTP 503 `{ ok: false }`.
  - `src/lib/config-status.ts:12-22` populates `missingConfigs` for the warning banner in `src/layouts/Layout.astro:33-46`.
- **CI & E2E Testing**:
  - `.github/workflows/ci.yml:31-83` (`security-integration` job) starts local Supabase, exports env vars to `$GITHUB_ENV`, and runs `npx playwright test`.
  - `e2e/auth.setup.ts:13-19`, `e2e/auth-user-b.setup.ts:13-19`, and `e2e/password-recovery.spec.ts:20-27` submit `/auth/signin` and `/auth/forgot-password` in a real browser.

## Desired End State

- Every public auth form (`/auth/signin`, `/auth/signup`, `/auth/forgot-password`) renders a Cloudflare Turnstile widget (`theme="light"`, `size="flexible"`, `language={locale}`) above the submit button and includes the `cf-turnstile-response` field in the form submission.
- Clicking Submit before Turnstile produces a token (or after a token expires/errors) is caught client-side in `handleSubmit`, preventing navigation and showing a localized inline error message (`auth.validation.captcha_required`).
- Direct or automated `POST` requests to `/api/auth/signin`, `/api/auth/signup`, or `/api/auth/forgot-password` without a valid `cf-turnstile-response` token (or when `TURNSTILE_SECRET_KEY` is missing or Cloudflare `siteverify` fails/times out) are rejected **before** calling Supabase Auth and redirect back to the originating form with `?error=captcha_failed`.
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are declared in `astro.config.mjs`, checked in `/api/health` and `src/lib/config-status.ts`, and pre-populated with Cloudflare's official dummy keys in `.env.example` and `.github/workflows/ci.yml` so local development and CI work out of the box.

### Key Discoveries:

- Native HTML `<form method="POST">` submission in `SignInForm.tsx:56`, `SignUpForm.tsx:92`, and `ForgotPasswordForm.tsx:46` means Turnstile's hidden `<input name="cf-turnstile-response" />` is automatically serialized into `context.request.formData()` on the server without changing the form transport.
- `forgot-password.ts:9-12` runs `forgotPasswordRedirectTarget(email, null)` before touching Supabase; email format validation should stay first, followed immediately by Turnstile verification so invalid tokens never trigger `resetPasswordForEmail` or leak account existence.
- Cloudflare provides official dummy credentials (`sitekey = 1x00000000000000000000AA`, `secret = 1x0000000000000000000000000000000AA`) that work on `localhost` and always pass `siteverify`.

## What We're NOT Doing

- **No Turnstile on `/auth/reset-password` or `/auth/recover`**: Setting a new password already requires a valid single-use recovery token from the user's email inbox (per Roadmap S-12 non-goals).
- **No Turnstile on authenticated routes or AI generation**: `/api/ai/generate`, `/api/auth/signout`, `/api/auth/delete-account`, and `/dashboard` are for signed-in users only.
- **No Supabase GoTrue `[auth.captcha]` activation**: Verification is owned by our Astro API routes so local Supabase and hosted Supabase require no dashboard CAPTCHA changes.
- **No third-party React Turnstile wrapper package**: We will write a lightweight `TurnstileWidget` component against Cloudflare's `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` API to avoid external dependency churn and keep `npm audit` clean.
- **No custom IP rate-limiter or WAF rule configuration**: Out of scope for S-12.

## Implementation Approach

We split the implementation into two testable phases:
1. **Phase 1 (Server & Contracts)**: Add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to `astro.config.mjs`, `.env.example`, `/api/health`, and `src/lib/config-status.ts`. Build `src/lib/turnstile.ts` (`verifyTurnstileToken` + `extractTurnstileToken` + `resolveClientIp`) with fail-closed semantics, add `captcha_failed` to `src/lib/auth-errors.ts` and PL/EN dictionaries, wire verification into `POST /api/auth/signin`, `POST /api/auth/signup`, and `POST /api/auth/forgot-password`, and cover all branches with Vitest unit tests.
2. **Phase 2 (Client Widget, Auth Pages & E2E)**: Build `src/components/auth/TurnstileWidget.tsx` using explicit Turnstile rendering (`theme: "light"`, `size: "flexible"`, `language: locale`) with clean unmount cleanup and deterministic fallback if the external script fails or is blocked in headless CI. Pass `turnstileSiteKey` from the three Astro auth pages into `SignInForm`, `SignUpForm`, and `ForgotPasswordForm`, enforce client-side token presence on submit, update `.github/workflows/ci.yml` with Cloudflare's test keys, and add Playwright E2E coverage.

## Critical Implementation Details

- **Timing & lifecycle (React hydration + Turnstile script loading)**: Because `SignInForm`, `SignUpForm`, and `ForgotPasswordForm` mount with `client:load`, `TurnstileWidget` must load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` idempotently (reusing a single `<script>` tag if already present), call `window.turnstile.render(...)` inside `useEffect`, and call `window.turnstile.remove(widgetId)` on unmount so React StrictMode double-effects do not render duplicate iframes.
- **Deterministic E2E with official test sitekey (`1x00000000000000000000AA`)**: In Playwright (`e2e/auth.setup.ts`, `e2e/auth-user-b.setup.ts`, `e2e/password-recovery.spec.ts`), the test clicks Submit immediately after filling inputs. Waiting for an external `challenges.cloudflare.com` iframe over the network would make `auth.setup.ts` race against the click or fail if external network is slow. When `siteKey === "1x00000000000000000000AA"` (Cloudflare's official dummy sitekey), `TurnstileWidget` should initialize the hidden `cf-turnstile-response` input with `"XXXX.DUMMY.TOKEN.XXXX"` immediately on mount (while still rendering the visual widget container when `window.turnstile` loads), ensuring `new FormData(form)` always has a valid dummy token on immediate E2E submit without weakening production sitekeys.
- **State sequencing in `POST /api/auth/forgot-password`**: Validate email syntax first (`forgotPasswordRedirectTarget(email, null)`), then verify Turnstile (`verifyTurnstileToken`), then check `context.locals.supabase`, and finally call `supabase.auth.resetPasswordForEmail`. This preserves existing invalid-email UX while guaranteeing bots cannot trigger recovery emails or probe accounts without a valid Turnstile token.

---

## Phase 1: Server-Side Verification, Environment Schema & Unit Tests

### Overview

Add the server-side Turnstile verification helper, environment schema declarations, readiness/config-banner checks, localized error keys, and guard all three public auth `POST` endpoints (`signin`, `signup`, `forgot-password`), backed by unit tests.

### Changes Required:

#### 1. Environment Schema & Example Config

**File**: `astro.config.mjs`

**Intent**: Declare `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `env.schema` so server routes and Astro pages can read them via `astro:env/server` in both Node/Vitest and Cloudflare Workers runtime.

**Contract**: Add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` as `envField.string({ context: "server", access: "secret", optional: true })` in `astro.config.mjs`.

**File**: `.env.example`

**Intent**: Document both Turnstile environment variables and default them to Cloudflare's official always-pass dummy keys so local setup (`cp .env.example .env`) works immediately.

**Contract**: Add `TURNSTILE_SITE_KEY=1x00000000000000000000AA` and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` with explanatory comments.

#### 2. Localization & Auth Error Mapping

**File**: `src/lib/i18n/en.ts` and `src/lib/i18n/pl.ts`

**Intent**: Provide English and Polish strings for client-side missing-token validation, server-side verification failure, and the missing-configuration warning banner.

**Contract**: Add the following keys to both `en` and `pl`:
- `"auth.validation.captcha_required"`: EN `"Please complete the security check."` / PL `"Potwierdź, że nie jesteś botem."`
- `"auth.error.captcha_failed"`: EN `"Security verification failed. Please try again."` / PL `"Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie."`
- `"config.turnstile.message"`: EN `"Cloudflare Turnstile is not configured — authentication forms will reject submissions."` / PL `"Cloudflare Turnstile nie jest skonfigurowany — formularze logowania i rejestracji będą odrzucać zgłoszenia."`

**File**: `src/lib/auth-errors.ts`

**Intent**: Register `captcha_failed` as a first-class `AuthErrorKey` so `/auth/signin?error=captcha_failed`, `/auth/signup?error=captcha_failed`, and `/auth/forgot-password?error=captcha_failed` resolve to `auth.error.captcha_failed`.

**Contract**: Extend `AuthErrorKey`, `AUTH_ERROR_KEYS`, and `AUTH_ERROR_MESSAGE_KEYS` with `captcha_failed: "auth.error.captcha_failed"`.

#### 3. Health Check & Config Banner

**File**: `src/pages/api/health.ts`

**Intent**: Include `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the production readiness check so post-deploy smoke checks detect missing Turnstile Worker secrets.

**Contract**: Import `TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY` from `astro:env/server` and require both to be truthy in `configured`.

**File**: `src/lib/config-status.ts`

**Intent**: Surface a warning banner in `Layout.astro` when `TURNSTILE_SITE_KEY` or `TURNSTILE_SECRET_KEY` is missing in local development.

**Contract**: Import `TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY` from `astro:env/server` and append a `{ name: "Turnstile", configured: Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY), messageKey: "config.turnstile.message", docsUrl: "https://developers.cloudflare.com/turnstile/get-started/", docsLabelKey: "config.docs_label" }` entry to `configStatuses`.

#### 4. Turnstile Verification Service

**File**: `src/lib/turnstile.ts`

**Intent**: Provide a pure, testable, fail-closed verification module that extracts `cf-turnstile-response` from `FormData`, resolves the client IP from request headers, and validates the token against `https://challenges.cloudflare.com/turnstile/v0/siteverify`.

**Contract**:
- `TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response"`
- `TURNSTILE_DUMMY_SITE_KEY = "1x00000000000000000000AA"`
- `TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"`
- `extractTurnstileToken(form: FormData): string` — returns trimmed string value of `cf-turnstile-response` (or `""`).
- `resolveClientIp(headers: Headers): string | undefined` — reads `CF-Connecting-IP` or first IP of `X-Forwarded-For`.
- `verifyTurnstileToken(input: { token: string; remoteIp?: string; secretKey?: string; fetchImpl?: typeof fetch }): Promise<boolean>`:
  - Reads `secretKey ?? TURNSTILE_SECRET_KEY`.
  - Returns `false` immediately if `!secret` or `!token` or `token.length > 2048`.
  - Sends `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `Content-Type: application/x-www-form-urlencoded`, `body: new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) })`, and `AbortSignal.timeout(10_000)`.
  - Parses JSON `{ success?: boolean }` and returns `result.success === true`. Any HTTP error, timeout, or exception returns `false` (fail-closed).

#### 5. Auth API Route Enforcement

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Reject sign-in `POST` requests when Turnstile verification fails before calling `supabase.auth.signInWithPassword`.

**Contract**: Extract token via `extractTurnstileToken(form)` and verify with `verifyTurnstileToken({ token, remoteIp: resolveClientIp(context.request.headers) })`. If `false`, redirect to `/auth/signin?error=captcha_failed`.

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Reject sign-up `POST` requests when Turnstile verification fails before calling `supabase.auth.signUp`.

**Contract**: Extract token via `extractTurnstileToken(form)` and verify with `verifyTurnstileToken({ token, remoteIp: resolveClientIp(context.request.headers) })`. If `false`, redirect to `/auth/signup?error=captcha_failed`.

**File**: `src/pages/api/auth/forgot-password.ts`

**Intent**: Reject password-recovery `POST` requests when Turnstile verification fails before calling `supabase.auth.resetPasswordForEmail`.

**Contract**: After `forgotPasswordRedirectTarget(email, null)` validates email format, verify Turnstile token. If `false`, redirect to `/auth/forgot-password?error=captcha_failed`.

#### 6. Unit Tests for Turnstile & Auth Error Resolution

**File**: `src/lib/turnstile.test.ts`

**Intent**: Verify fail-closed behavior of `verifyTurnstileToken`, `extractTurnstileToken`, `resolveClientIp`, and `resolveAuthErrorMessage("en" | "pl", "captcha_failed")`.

**Contract**: Cover:
- Missing/empty token or token > 2048 chars → `false` without calling `fetch`.
- Missing `secretKey` → `false` without calling `fetch`.
- `siteverify` returns `{ success: true }` → `true` and forwards `secret`, `response`, and `remoteip`.
- `siteverify` returns `{ success: false, "error-codes": ["timeout-or-duplicate"] }` → `false`.
- `siteverify` returns non-2xx HTTP status or throws network/timeout error → `false`.
- `resolveAuthErrorMessage` maps `"captcha_failed"` to localized EN and PL messages.

### Success Criteria:

#### Automated Verification:

- Astro env types sync cleanly: `npx astro sync`
- Unit tests pass: `npm test`
- Linting passes: `npm run lint`

#### Manual Verification:

- Sending a raw `POST /api/auth/signin` without `cf-turnstile-response` redirects to `/auth/signin?error=captcha_failed`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Client-Side TurnstileWidget, Auth Forms/Pages & E2E Tests

### Overview

Build the reusable React `TurnstileWidget` component, wire `turnstileSiteKey` from the three Astro auth pages into `SignInForm`, `SignUpForm`, and `ForgotPasswordForm` with inline validation, update CI env configuration, and add Playwright E2E coverage.

### Changes Required:

#### 1. Reusable TurnstileWidget React Component

**File**: `src/components/auth/TurnstileWidget.tsx`

**Intent**: Render Cloudflare Turnstile in explicit mode (`theme: "light"`, `size: "flexible"`, `language: locale`), maintain a single synchronized `cf-turnstile-response` form field, and report token state changes (`onTokenChange`) and inline errors to the parent auth form.

**Contract**:
```tsx
export interface TurnstileWidgetProps {
  siteKey?: string;
  locale: AppLocale;
  error?: string;
  onTokenChange?: (token: string) => void;
}
```
- Renders a hidden `<input type="hidden" name="cf-turnstile-response" value={token} />` so React owns the exact token value submitted in `new FormData(form)` (with `response-field: false` passed to `turnstile.render` to avoid duplicate inputs).
- When `siteKey === TURNSTILE_DUMMY_SITE_KEY` (`"1x00000000000000000000AA"`), initializes `token` to `TURNSTILE_DUMMY_TOKEN` (`"XXXX.DUMMY.TOKEN.XXXX"`) on mount so immediate E2E form submissions always include a valid test token even before the external Cloudflare script finishes loading.
- Injects `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once into `document.head` and renders the widget container with `theme: "light"`, `size: "flexible"`, `language: locale`, `response-field: false`, `callback: (t) => ...`, `"expired-callback": () => ...`, and `"error-callback": () => ...`.
- Cleans up via `window.turnstile.remove(widgetId)` on unmount.
- Displays `error` below the widget container using the same `text-destructive text-xs` styling as `FormField`.

#### 2. Auth React Forms (`SignInForm`, `SignUpForm`, `ForgotPasswordForm`)

**File**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/ForgotPasswordForm.tsx`

**Intent**: Embed `TurnstileWidget` above `ServerError` / `SubmitButton` in all three forms and validate that `cf-turnstile-response` is non-empty in `validate(form)` before allowing form submission.

**Contract**:
- Add `turnstileSiteKey?: string` to `Props` in `SignInForm.tsx`, `SignUpForm.tsx`, and `ForgotPasswordForm.tsx`.
- Extend `errors` state with `captcha?: string`.
- In `validate(form: HTMLFormElement)`, check `const captchaToken = formValue(fd, "cf-turnstile-response").trim(); if (!captchaToken) { next.captcha = t("auth.validation.captcha_required"); }`.
- Clear `errors.captcha` when `TurnstileWidget` invokes `onTokenChange` with a non-empty token.

#### 3. Astro Auth Pages (`signin.astro`, `signup.astro`, `forgot-password.astro`)

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/forgot-password.astro`

**Intent**: Read `TURNSTILE_SITE_KEY` from `astro:env/server` during SSR and pass `turnstileSiteKey={TURNSTILE_SITE_KEY}` to `SignInForm`, `SignUpForm`, and `ForgotPasswordForm`.

**Contract**: Import `{ TURNSTILE_SITE_KEY } from "astro:env/server"` in each of the three `.astro` pages and pass `turnstileSiteKey={TURNSTILE_SITE_KEY}` to the respective form component.

#### 4. CI Workflow, Playwright E2E Tests & Documentation

**File**: `.github/workflows/ci.yml`

**Intent**: Export Cloudflare's official dummy Turnstile keys in the `security-integration` job so `/api/health` returns 200 and Playwright E2E tests pass `siteverify`.

**Contract**: Add `TURNSTILE_SITE_KEY=1x00000000000000000000AA` and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` to the `Export local test configuration` step in `.github/workflows/ci.yml:50-59`.

**File**: `e2e/auth-turnstile.spec.ts`

**Intent**: Verify in Playwright that direct `POST` requests to `/api/auth/signin`, `/api/auth/signup`, and `/api/auth/forgot-password` without a Turnstile token are rejected with `?error=captcha_failed` and that the error banner renders on the form.

**Contract**: Guest Playwright spec testing:
1. `POST /api/auth/signin`, `POST /api/auth/signup`, and `POST /api/auth/forgot-password` with missing `cf-turnstile-response` redirect to `?error=captcha_failed`.
2. Visiting `/auth/signin?error=captcha_failed` displays the localized security verification error alert (`ServerError`).

**File**: `README.md`

**Intent**: Document `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the Environment Variables table and the `npx wrangler secret put` deployment instructions.

**Contract**: Update the `## Environment Variables` table (`README.md:97-108`) and `## Deployment` secret list (`README.md:225-230`).

#### 5. Supporting files

**File**: `src/lib/turnstile-constants.ts`

Client-safe constants (`TURNSTILE_RESPONSE_FIELD`, dummy site key and token, script URL) so `TurnstileWidget` does not import `astro:env/server`. `src/lib/turnstile.ts` re-exports them.

**File**: `playwright.config.ts`

Guest project `testMatch` includes `auth-turnstile.spec.ts`. The authenticated Chromium project ignores that spec.

**File**: `e2e/password-recovery.spec.ts`

Wait for `form[data-hydrated='true']` before the empty-submit assertion so the dummy Turnstile token is in the form.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Linting passes: `npm run lint`
- Production SSR build succeeds: `npm run build`
- Playwright E2E suite passes (when local Supabase is running with dummy Turnstile keys in `.env`): `npm run test:e2e`

#### Manual Verification:

- Visit `/auth/signin`, `/auth/signup`, and `/auth/forgot-password` in the browser: the Turnstile widget renders in Paper style above the submit button in both PL and EN locales, and sign-in, sign-up, and forgot-password flows succeed with a valid token.
- Submitting any of the three forms when the token is missing or invalid shows the localized error message and does not authenticate or send a reset email.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `src/lib/turnstile.test.ts`:
  - `extractTurnstileToken` extracts and trims `cf-turnstile-response` from `FormData`.
  - `resolveClientIp` prefers `CF-Connecting-IP` and falls back to the first address in `X-Forwarded-For`.
  - `verifyTurnstileToken` returns `false` when token is empty, exceeds 2048 chars, or secret key is missing.
  - `verifyTurnstileToken` returns `true` when Cloudflare `siteverify` responds `{ success: true }`.
  - `verifyTurnstileToken` returns `false` when `siteverify` responds `{ success: false }`, non-200 status, or throws on timeout/network failure.
  - `resolveAuthErrorMessage` resolves `"captcha_failed"` in both `"en"` and `"pl"`.

### Integration / E2E Tests:

- `e2e/auth-turnstile.spec.ts`:
  - Verifies that `POST /api/auth/signin`, `POST /api/auth/signup`, and `POST /api/auth/forgot-password` without `cf-turnstile-response` redirect with `?error=captcha_failed`.
  - Verifies that `/auth/signin?error=captcha_failed` renders the visible error alert.
- Existing E2E specs (`e2e/auth.setup.ts`, `e2e/auth-user-b.setup.ts`, `e2e/password-recovery.spec.ts`, `e2e/health.spec.ts`) continue to pass with dummy Turnstile keys.

### Manual Testing Steps:

1. Ensure `.env` and `.dev.vars` contain `TURNSTILE_SITE_KEY=1x00000000000000000000AA` and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`.
2. Start `npm run dev` and open `/auth/signin`, `/auth/signup`, and `/auth/forgot-password` in both PL and EN locales. Confirm the Turnstile widget renders cleanly inside the Paper card.
3. Complete sign-in, sign-up, and forgot-password flows and confirm normal redirects (`/dashboard`, `/auth/confirm-email`, `/auth/check-email`).
4. Before production deployment, set real Cloudflare Turnstile keys via `npx wrangler secret put TURNSTILE_SITE_KEY` and `npx wrangler secret put TURNSTILE_SECRET_KEY`.

## Performance Considerations

- Cloudflare's `turnstile/v0/api.js` script is loaded asynchronously (`async defer`) only on the three guest auth pages (`/auth/signin`, `/auth/signup`, `/auth/forgot-password`), adding zero overhead to `/`, `/dashboard`, `/sets/*`, or `/settings`.
- Server-side `siteverify` runs with a 10-second `AbortSignal.timeout(10_000)` only on auth `POST` actions.

## Migration Notes

- No database migrations are required.
- Local developers copying `.env.example` get Cloudflare's official dummy keys automatically; existing `.env` / `.dev.vars` files should add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` from `.env.example`.
- Production Worker requires two new secrets before deploying this slice:
  - `npx wrangler secret put TURNSTILE_SITE_KEY`
  - `npx wrangler secret put TURNSTILE_SECRET_KEY`

## References

- Roadmap slice S-12: `context/foundation/roadmap.md:257-270`
- Prior auth slice (S-11 Password Recovery): `context/archive/2026-10-27-password-recovery/plan-brief.md`
- Cloudflare Turnstile docs: `https://developers.cloudflare.com/turnstile/get-started/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server-Side Verification, Environment Schema & Unit Tests

#### Automated

- [x] 1.1 Astro env types sync cleanly: `npx astro sync` — dfac4fa
- [x] 1.2 Unit tests pass: `npm test` — dfac4fa
- [x] 1.3 Linting passes: `npm run lint` — dfac4fa

#### Manual

- [x] 1.4 Sending a raw `POST /api/auth/signin` without `cf-turnstile-response` redirects to `/auth/signin?error=captcha_failed` — dfac4fa

### Phase 2: Client-Side TurnstileWidget, Auth Forms/Pages & E2E Tests

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 6544e14
- [x] 2.2 Linting passes: `npm run lint` — 6544e14
- [x] 2.3 Production SSR build succeeds: `npm run build` — 6544e14
- [ ] 2.4 Playwright E2E suite passes: `npm run test:e2e`

#### Manual

- [x] 2.5 Turnstile widget renders in Paper style on `/auth/signin`, `/auth/signup`, and `/auth/forgot-password` in PL/EN and allows valid submissions while rejecting missing/invalid tokens — 6544e14
