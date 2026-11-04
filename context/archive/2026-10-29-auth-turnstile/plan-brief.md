# Auth Turnstile Bot Protection — Plan Brief

> Full plan: `context/changes/auth-turnstile/plan.md`

## What & Why

Publiczne formularze uwierzytelniania (`/auth/signin`, `/auth/signup`, `/auth/forgot-password`) są dziś otwarte na automatyczne żądania botów (brute-force haseł, masowe zakładanie kont i zalewanie skrzynek mailami resetu). Dodajemy Cloudflare Turnstile po stronie formularzy React oraz obowiązkową weryfikację `siteverify` po stronie serwera w endpointach Astro API, zanim żądanie dotknie Supabase Auth.

## Starting Point

Trzy formularze auth (`SignInForm`, `SignUpForm`, `ForgotPasswordForm`) wysyłają natywny HTML `POST` do `/api/auth/{signin,signup,forgot-password}`, a błędy serwera wracają przez redirect `?error=<AuthErrorKey>`. Wszystkie sekrety środowiskowe są deklarowane w `astro.config.mjs` jako `astro:env/server` i sprawdzane w `/api/health` oraz `src/lib/config-status.ts`.

## Desired End State

Gość na `/auth/signin`, `/auth/signup` i `/auth/forgot-password` widzi widget Cloudflare Turnstile dopasowany do Paper UI i wybranego języka (PL/EN). Kliknięcie wyślij bez ważnego tokenu pokazuje komunikat walidacji inline, a każde żądanie `POST` bez poprawnego tokenu `cf-turnstile-response` jest odrzucane przez serwer z redirectem `?error=captcha_failed` przed wywołaniem Supabase Auth.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Miejsce weryfikacji tokenu | W endpointach Astro API (`src/lib/turnstile.ts` → Cloudflare `siteverify`) | Daje pełną kontrolę nad błędami `?error=captcha_failed` i kluczami testowymi bez ręcznej konfiguracji panelu Supabase. |
| Wygląd widgetu | Managed mode, `theme="light"`, `size="flexible"`, `language={locale}` | Pasuje do jasnej karty `PaperShell` (`max-w-sm`) i respektuje wybrany język PL/EN. |
| Zachowanie przycisku Submit | Przycisk aktywny; walidacja tokenu w `handleSubmit` z błędem inline | Spójne z obecną walidacją pól formularza i nie blokuje użytkownika na szaro, gdy skrypt się ładuje. |
| Klucze w dev / CI / E2E | Fail-closed na serwerze + oficjalne klucze testowe Cloudflare w `.env.example` i CI | Zachowuje pełne bezpieczeństwo na produkcji i deterministyczne, szybkie testy Playwright w CI. |
| Dostarczenie `TURNSTILE_SITE_KEY` | `astro:env/server` w stronach `.astro` → prop `turnstileSiteKey` do formularzy | Działa jako runtime secret w Cloudflare Workers bez wypalania klucza podczas `npm run build`. |
| Błąd serwera przy odrzuceniu | Dedykowany klucz `?error=captcha_failed` (PL/EN) | Użytkownik jasno widzi, że powodem odrzucenia była weryfikacja bezpieczeństwa, a nie hasło czy serwer. |
| Readiness i dev banner | Wymagaj obu kluczy Turnstile w `/api/health` oraz `missingConfigs` | Post-deploy smoke check i lokalny baner od razu wykryją brak skonfigurowanych sekretów Workera. |

## Scope

**In scope:** widget Turnstile na `/auth/signin`, `/auth/signup`, `/auth/forgot-password`; weryfikacja `siteverify` w `POST /api/auth/{signin,signup,forgot-password}`; `TURNSTILE_SITE_KEY` i `TURNSTILE_SECRET_KEY` w `astro.config.mjs`, `.env.example`, `/api/health`, `config-status.ts`, `.github/workflows/ci.yml` i `README.md`; tłumaczenia PL/EN; testy jednostkowe Vitest i E2E Playwright.

**Out of scope:** Turnstile na `/auth/reset-password` i `/auth/recover`, na generowaniu AI (`/api/ai/generate`) i trasach zalogowanego użytkownika; włączanie `[auth.captcha]` w Supabase GoTrue; zewnętrzne paczki npm dla React Turnstile; osobny rate-limiter IP.

## Architecture / Approach

Strony `src/pages/auth/{signin,signup,forgot-password}.astro` odczytują `TURNSTILE_SITE_KEY` z `astro:env/server` i przekazują go do `SignInForm`, `SignUpForm` i `ForgotPasswordForm`. Nowy komponent `src/components/auth/TurnstileWidget.tsx` ładuje skrypt `challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` i utrzymuje ukryte pole `<input type="hidden" name="cf-turnstile-response" />`. Endpointy `POST /api/auth/{signin,signup,forgot-password}.ts` wywołują `verifyTurnstileToken` z `src/lib/turnstile.ts` przed wywołaniem Supabase i w razie błędu przekierowują z `?error=captcha_failed`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Server-Side Verification, Env Schema & Unit Tests | `astro.config.mjs`, `.env.example`, `src/lib/turnstile.ts`, `captcha_failed` PL/EN, ochrona 3 endpointów `POST`, `/api/health`, `config-status.ts`, testy Vitest | Kolejność walidacji w `forgot-password.ts` (najpierw format e-mail, potem Turnstile, potem Supabase). |
| 2. Client-Side TurnstileWidget, Auth Forms/Pages & E2E | `TurnstileWidget.tsx`, integracja w 3 formularzach i 3 stronach `.astro`, klucze testowe w CI, spec E2E `auth-turnstile.spec.ts`, `README.md` | Wyścig ładowania zewnętrznego skryptu Turnstile z natychmiastowym kliknięciem Submit w istniejących testach Playwright (`auth.setup.ts`). |

**Prerequisites:** Działające przepływy auth (S-08, S-09, S-11) oraz lokalny Supabase dla testów E2E.
**Estimated effort:** ~1–2 sesje implementacyjne w 2 fazach.

## Open Risks & Assumptions

- Przed wdrożeniem na produkcję właściciel projektu musi dodać `TURNSTILE_SITE_KEY` i `TURNSTILE_SECRET_KEY` do sekretów Cloudflare Workera (`npx wrangler secret put`), inaczej `/api/health` zwróci 503, a formularze auth odrzucą logowanie.
- W środowisku lokalnym i CI używamy oficjalnej pary kluczy testowych Cloudflare (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`), które zawsze przechodzą `siteverify`.

## Success Criteria (Summary)

- Formularze `/auth/signin`, `/auth/signup` i `/auth/forgot-password` wyświetlają widget Turnstile w stylu Paper (PL/EN) i blokują wysłanie bez tokenu komunikatem walidacji.
- Żądania `POST` do `/api/auth/signin`, `/api/auth/signup` i `/api/auth/forgot-password` bez ważnego tokenu są odrzucane przez serwer z `?error=captcha_failed` bez wywołania Supabase Auth.
- Pełny zestaw testów (`npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`) przechodzi w CI.
