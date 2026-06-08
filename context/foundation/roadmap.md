---
project: "10xCards"
version: 1
status: active
created: 2026-05-25
updated: 2026-06-08
prd_version: 1
prd_v2_slice: S-05
shape_notes_slice: S-07
prd_v3_slice: S-07
main_goal: speed
top_blocker: test coverage
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + `context/foundation/prd-v2.md` (S-05) + `context/foundation/shape-notes.md` (S-07) + `context/foundation/dashboard-redesign-proposal.md` + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Ręczne tworzenie fiszek edukacyjnych jest skrajnie czasochłonne — ta bariera blokuje adopcję spaced repetition u osób, które mają materiał, ale nie mają czasu na redakcję. 10xCards eliminuje tę barierę: użytkownik wkleja tekst, modele językowe generują pary pytanie-odpowiedź w sekundy, a wbudowany silnik SRS planuje powtórki automatycznie. Żadne z popularnych narzędzi (Anki, Quizlet) nie łączy tych trzech warstw — generowanie + zarządzanie + powtórki — w jednym miejscu.

## North star

**S-02: Generowanie AI + zapis** — użytkownik wkleja tekst, widzi wygenerowane przez AI fiszki, akceptuje / edytuje / usuwa i zapisuje do zestawu.

> Gwiazda przewodnia — najmniejszy end-to-end przepływ, który udowadnia główną hipotezę produktu (że AI generuje fiszki wystarczającej jakości, aby je przyjąć bez większych poprawek) — umieszczona jak najwcześniej, bo wszystko inne ma sens tylko wtedy, gdy ta hipoteza się potwierdzi.

## At a glance

| ID   | Change ID             | Outcome (user can …)                                                                                                   | Prerequisites | PRD refs                                     | Status   |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------- | -------- |
| F-01 | data-schema-rls       | (foundation) tabele aplikacji i polityki RLS lądują w Supabase; każda warstwa odczytu i zapisu ma bezpieczną bazę      | —             | NFR trwałość, NFR prywatność, Access Control | done     |
| F-02 | deploy-pipeline       | (foundation) pipeline CI/CD do Cloudflare Workers; merge do master = automatyczny release                              | —             | —                                            | done     |
| S-01 | flashcard-sets-ui     | tworzyć i przeglądać własne zestawy fiszek po zalogowaniu                                                              | F-01          | FR-001, FR-002, FR-003, FR-007               | done     |
| S-05 | set-dashboard-lifecycle | zmienić nazwę zestawu i usunąć zestaw (pusty lub z fiszkami) z listy na dashboardzie                                 | F-01, S-01    | prd-v2 Scope [new], US-01                    | done     |
| S-02 | ai-generation-save    | wkleić tekst, zobaczyć fiszki AI, zaakceptować / edytować / usunąć i zapisać do zestawu                                | F-01, S-01    | FR-004, FR-005, US-01                        | done |
| S-03 | manual-flashcard-crud | ręcznie dodać, edytować i usunąć fiszkę w zestawie                                                                     | F-01, S-01    | FR-006, FR-008, FR-009, US-02                | done     |
| S-04 | srs-review-session    | rozpocząć sesję powtórkową SRS i zobaczyć, że system automatycznie planuje kolejną datę przeglądu po każdej odpowiedzi | F-01, S-01    | FR-010, FR-011, US-01                        | done |
| S-06 | account-deletion      | trwale usunąć swoje konto wraz ze wszystkimi zestawami i fiszkami (po potwierdzeniu)                                   | F-01          | NFR prywatność, Access Control               | done     |
| S-07 | study-hub-ui          | study hub na `/dashboard` + landing `/` + paper theme na `/sets/<id>`; due dziś, **Study**, kafelki zestawów | F-01, S-01, S-02, S-04, S-05 | prd-v3, US-01–US-04, landing-copy.md | done |
| S-08 | unified-paper-ui      | cała aplikacja w jednym stylu paper (review, settings, auth); brak skoków cosmic ↔ paper między ekranami | S-07 | study-hub-ui plan, paper tokens | done |
| S-09 | bilingual-ui          | cała aplikacja po polsku lub po angielsku; wybór języka na landingu (domyślnie z przeglądarki); po zalogowaniu bez zmiany | S-07, S-08 | shape-notes (ex-i18n non-goal), landing-copy.md | done |
| S-10 | app-icon-favicon      | widzieć spójną ikonę 10xCards w zakładce przeglądarki (favicon) i przy dodawaniu aplikacji do ekranu głównego | S-08 | NFR użyteczność, paper theme | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                    | Note                                                                           |
| ------ | -------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| A      | Krytyczna ścieżka AI | `F-01` → `S-01` → `S-02` ✓ | Zakończony — north star S-02 wdrożony i zarchiwizowany.                         |
| A′     | Lifecycle zestawów   | `S-05` ✓                 | Zakończony — rename/delete na dashboardzie (`SetDashboardGrid`).                |
| B      | Ręczne CRUD fiszek   | `S-03` ✓                 | Zakończony — `SetFlashcardsManager` + API CRUD na `/sets/<id>`.                   |
| C      | Sesja SRS            | `S-04` ✓                 | Zakończony — `ts-fsrs`, `/sets/<id>/review`, grade API.                         |
| D      | Pipeline deploymentu | `F-02` ✓                 | Zakończony — auto-deploy na merge do `master` (archiwum 2026-06-08). |
| E      | Konto / compliance   | `S-06` ✓                 | Zakończony — `AccountDangerZone`, `POST /api/auth/delete-account`, service role. |
| F      | Dashboard / study hub | `S-07` ✓                | Zakończony — study hub, landing, set detail paper theme.                          |
| G      | Spójność UI           | `S-08` ✓                | Zakończony — paper theme na review, settings, auth.                               |
| H      | Dwujęzyczność UI      | `S-09` ✓                | Zakończony — PL/EN, locale cookie, locked after login.                            |
| I      | Branding / ikona      | `S-10` ✓                | Zakończony — favicon, apple-touch-icon, `site.webmanifest` (archiwum 2026-06-08). |

## Baseline

What's already in place in the codebase as of `2026-06-08` (auto-researched + archived slices).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + shadcn/ui + Tailwind CSS 4; paper theme (`PaperShell`, `AppTopbar`) na wszystkich trasach użytkownika; i18n PL/EN (`src/lib/i18n/`)
- **Backend / API:** present — auth, flashcard sets CRUD, flashcards CRUD, AI generation (`/api/ai/generate`), SRS (`/api/srs/due`, `/api/srs/grade`), account deletion (`/api/auth/delete-account`)
- **Data:** present — migracje Supabase (`supabase/migrations/20260526211944_flashcard_schema.sql`); tabele `flashcard_sets`, `flashcards` z polami SRS; RLS per użytkownik
- **Auth:** present — Supabase SSR, sesje cookie, middleware (`PROTECTED_ROUTES`), service role tylko do usuwania konta
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`); CI lint+build+deploy na `master` (`.github/workflows/ci.yml`); smoke check na `PRODUCTION_URL`
- **Branding:** present — `public/favicon.png`, `favicon.ico`, `apple-touch-icon.png`, `site.webmanifest`; linki w `Layout.astro`
- **Observability:** partial — Cloudflare Workers observability włączona; brak Sentry/OTel na poziomie aplikacji (parked)
- **Tests:** none — brak Vitest/Playwright; strategia w `context/foundation/test-plan.md` (status: active)

## Foundations

### F-01: Data schema + RLS

- **Outcome:** (foundation) tabele aplikacji (`flashcard_sets`, `flashcards` z polami SRS) zamigrowane w Supabase; polityki RLS gwarantują, że każdy użytkownik widzi wyłącznie własne zestawy — schemat gotowy do odczytu i zapisu przez wszystkie slice'y.
- **Change ID:** data-schema-rls
- **PRD refs:** NFR ("no card is lost due to a system error"), NFR ("source text submitted for generation leaves no trace in any operator-accessible storage"), Access Control ("zestawy fiszek są prywatne — widoczne tylko dla właściciela konta")
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Jedyna zmiana infra blokująca wszystkie slice'y; błąd w projekcie schematu (np. brak pola dla harmonogramu SRS) wymusi późniejszą migrację modyfikującą kolumny — warto zaprojektować pola SRS (`interval`, `ease_factor`, `due_date`) razem z resztą schematu.
- **Status:** done

### F-02: Deploy pipeline

- **Outcome:** (foundation) zadanie deploy w GitHub Actions uruchamia `wrangler deploy` po każdym merge do master; każdy slice może trafić na produkcję bez ręcznych kroków.
- **Change ID:** deploy-pipeline
- **PRD refs:** —
- **Unlocks:** weryfikacja produkcyjna każdego S-NN; bez tego każdy release jest ręczny
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Przy celu `speed` ręczny deploy to stały koszt tarcia; lepiej wdrożyć raz wcześnie niż wracać do tego w środku pracy nad slice'ami.
- **Status:** done

## Slices

### S-01: Zestawy fiszek

- **Outcome:** użytkownik może tworzyć nowy nazwany zestaw fiszek i przeglądać listę wszystkich swoich zestawów po zalogowaniu.
- **Change ID:** flashcard-sets-ui
- **PRD refs:** FR-001, FR-002, FR-003, FR-007, US-01 (prereq: "logged-in user with at least one named flashcard set")
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Fundament nawigacyjny — zrealizowany w `SetDashboardGrid` + `NewSetDialog` + API create/list.
- **Status:** done

### S-05: Lifecycle zestawów na dashboardzie

- **Outcome:** użytkownik może z listy zestawów na `/dashboard` zmienić nazwę zestawu (literówka / mylący tytuł) oraz usunąć zestaw — pusty jednym kliknięciem, z fiszkami po potwierdzeniu z liczbą kart do usunięcia.
- **Change ID:** set-dashboard-lifecycle
- **PRD refs:** `prd-v2.md` — Scope of Change [new] (rename, delete empty, delete with cards), US-01; Success Criteria Primary/Secondary
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niski — RLS i kaskada usuwania fiszek już w schemacie; ryzyko regresji na CRUD kart, AI i SRS przy testach ręcznych (brak Vitest w projekcie — patrz `test-plan.md`).
- **Status:** done

> Uzupełnia S-01 o brakujące operacje na poziomie zestawu. Non-goals: rename/delete na `/sets/<id>`, kosz, bulk delete (`prd-v2` §Non-Goals).

### S-02: Generowanie AI + zapis

- **Outcome:** użytkownik może wkleić surowy tekst, zobaczyć wygenerowane przez AI pary pytanie-odpowiedź, zaakceptować / edytować inline / usunąć pojedyncze karty i zapisać zaakceptowane do wybranego zestawu.
- **Change ID:** ai-generation-save
- **PRD refs:** FR-004, FR-005, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Latencja AI i limity CPU Cloudflare Workers — monitorować na produkcji; limity generacji w `ai-generation-limits`.
- **Status:** done

### S-03: Ręczne tworzenie i CRUD fiszek

- **Outcome:** użytkownik może ręcznie dodać nową fiszkę do zestawu, edytować pytanie lub odpowiedź istniejącej fiszki i usunąć fiszkę ze zbioru.
- **Change ID:** manual-flashcard-crud
- **PRD refs:** FR-006, FR-008, FR-009, US-02
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Klasyczne CRUD na istniejącym schemacie — małe ryzyko. Uwaga: edycja inline w S-02 i edycja post-save w S-03 używają podobnego UI; warto wydzielić wspólny komponent, żeby nie duplikować logiki.
- **Status:** done

### S-04: Sesja powtórkowa SRS

- **Outcome:** użytkownik może rozpocząć sesję powtórkową dla wybranego zestawu; po każdej odpowiedzi system automatycznie aktualizuje datę następnego przeglądu karty na podstawie algorytmu SRS.
- **Change ID:** srs-review-session
- **PRD refs:** FR-010, FR-011, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pola harmonogramu SRS muszą pasować do biblioteki — rozstrzygnięte: `ts-fsrs` + `due_at` w schemacie.
- **Status:** done

### S-06: Usunięcie konta

- **Outcome:** użytkownik może z poziomu ustawień konta trwale usunąć konto po potwierdzeniu; system usuwa konto w Supabase Auth oraz wszystkie powiązane zestawy i fiszki (kaskada / RLS).
- **Change ID:** account-deletion
- **PRD refs:** NFR prywatność, Access Control ("zestawy fiszek są prywatne — widoczne tylko dla właściciela konta")
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Usunięcie konta w Supabase Auth vs. kaskada danych aplikacji — trzeba zapewnić atomowość lub jasną kolejność (najpierw dane aplikacji, potem `auth.users`), żeby nie zostawić osieroconych wierszy; wymóg compliance (RODO) sugeruje brak soft-delete w MVP.
- **Status:** done

### S-07: Study hub — redesign dashboardu

- **Outcome:** użytkownik po zalogowaniu na `/dashboard` widzi due dziś i **Study** z kafelka; zarządza zestawami (kafelki, + New set, ⋯); generator AI + sync liczników bez regresji. Gość na `/` widzi landing 10xCards (AI + SRS, copy w `landing-copy.md`). Na `/sets/<id>` — ten sam paper theme, CRUD fiszek i **Start review** bez zmian funkcjonalnych. Sesja `/sets/<id>/review` — funkcja bez zmian, styl może zostać na później.
- **Change ID:** study-hub-ui
- **PRD refs:** `prd-v3.md` — Scope of Change, US-01–US-02; źródło kształtu: `shape-notes.md`, `dashboard-redesign-proposal.md`
- **Prerequisites:** F-01, S-01, S-02, S-04, S-05 (SRS `due_at`, generator na dashboardzie, lifecycle zestawów)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wyższy — paper theme na dashboard + landing + set detail; review/settings/auth celowo poza slice → **S-08**; brak testów auto. ~3 tyg. after-hours raczej ciasno — fazowanie: (1) tokeny + dashboard, (2) landing + set detail.
- **Status:** done

> Non-goals (slice): **pełna i18n PL/EN** (→ **S-09**), **redesign UI sesji review** (funkcja SRS bez zmian), migracje DB, glassmorphism. W scope: landing + `/sets/<id>` paper theme (2026-05-30). Copy: `landing-copy.md`. Pełna unifikacja UI (review, settings, auth) → **S-08**.

### S-08: Unified paper UI — pełna spójność wizualna

- **Outcome:** użytkownik porusza się po całej aplikacji bez zmiany „skórki” — wszystkie ekrany używają paper theme (`PaperShell`, `AppTopbar`, tokeny z Phase 1 S-07): landing `/`, dashboard, set detail, **sesja review** `/sets/<id>/review`, **ustawienia** `/settings`, **auth** `/auth/signin`, `/auth/signup`, `/auth/confirm-email`. Stary cosmic `Topbar.astro` i `bg-cosmic` zostają zastąpione lub ograniczone do legacy wyjątków (np. dev-only). Funkcje SRS, CRUD, auth i account deletion bez regresji — zmiana wyłącznie warstwy prezentacji.
- **Change ID:** unified-paper-ui
- **PRD refs:** NFR użyteczność; spójność produktu 10xCards (`prd-v3`, `shape-notes`); kontynuacja non-goal S-07 (review/settings/auth) jako osobny slice
- **Prerequisites:** S-07 (paper tokens, `PaperShell`, `AppTopbar`, dashboard + landing + set detail ukończone)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Średni — dotyka wielu plików i islandów React; sesja SRS wymaga ostrożności (nie zmieniać logiki grading). Warto fazować: (1) impl-review wszystkich tras + inventory cosmic classes, (2) auth + settings, (3) review UI, (4) cleanup `Topbar.astro` / dev preview / martwe style.
- **Status:** done

> Scope (planowane trasy): `index.astro`, `dashboard.astro`, `sets/[id]/index.astro`, `sets/[id]/review.astro`, `settings.astro`, `auth/*.astro`, wspólne komponenty (`SignInForm`, review UI, `FlashcardRow` theme default → paper). Non-goals: zmiany algorytmu SRS, migracje DB, **pełna i18n PL** (→ **S-09**), nowe funkcje.

### S-09: Dwujęzyczny interfejs (PL / EN)

- **Outcome:** gość na landingu `/` wybiera język interfejsu — **polski** lub **angielski** — albo dostaje domyślny na podstawie języka przeglądarki / systemu (`Accept-Language`, fallback EN). Po wyborze cała aplikacja (landing, auth, dashboard, zestawy, review, ustawienia, komunikaty błędów UI) renderuje się w tym języku. **Po zalogowaniu użytkownik nie może zmienić języka** — brak przełącznika w `/settings` ani w topbarze; wybrany locale jest trwały dla sesji / konta (szczegóły persystencji → `/10x-plan`).
- **Change ID:** bilingual-ui
- **PRD refs:** `shape-notes.md` (wcześniejszy non-goal i18n — superseded przez ten slice); `landing-copy.md` (EN jako baza tłumaczeń); NFR użyteczność (polski rynek docelowy)
- **Prerequisites:** S-07 (landing + dashboard + copy), S-08 (wszystkie trasy użytkownika w finalnym UI — tłumaczenie raz, na spójnym paper theme)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Średni — dotyka wszystkich tras i islandów React; ryzyko pominiętych stringów (regresja EN-only). Warto fazować: (1) infrastruktura locale + landing selector + cookie/metadata, (2) auth + landing, (3) dashboard + set + review + settings, (4) audyt stringów + smoke obu języków.
- **Status:** done

> **Scope:** selektor PL | EN na landingu; auto-detect `Accept-Language` (mapowanie `pl*` → PL, inaczej EN); propagacja locale do SSR i React; tłumaczenie istniejącego copy (dashboard, generator, SRS, auth, account deletion UI). **Non-goals:** więcej niż 2 języki; przełącznik języka po zalogowaniu; tłumaczenie treści fiszek generowanych przez AI (język fiszek = język źródłowego tekstu użytkownika); pełna lokalizacja dat/liczb poza `toLocaleString` tam gdzie już jest.

### S-10: Ikona aplikacji i favicon

- **Outcome:** użytkownik widzi spójną ikonę 10xCards w zakładce przeglądarki (favicon) oraz przy dodawaniu aplikacji do ekranu głównego (apple-touch-icon); ikona jest wygenerowana przez agenta AI i dopasowana do paper theme (Instrument Serif / DM Sans, paleta primary, motyw fiszek / nauki).
- **Change ID:** app-icon-favicon
- **PRD refs:** NFR użyteczność; spójność produktu 10xCards (`prd-v3`, paper tokens z S-07/S-08)
- **Prerequisites:** S-08 (finalna identyfikacja wizualna paper theme — ikona musi być spójna z resztą UI)
- **Parallel with:** S-06, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niski — zmiana wyłącznie assetów statycznych i meta w layoucie; ryzyko niskiej czytelności ikony w 16×16 — warto wygenerować kilka wariantów i wybrać najczytelniejszy.
- **Status:** done

> **Scope:** wygenerowanie ikony przez agenta; pliki w `public/` (`favicon.png`, `favicon.ico`, `apple-touch-icon.png`); `site.webmanifest` z `theme_color`; aktualizacja `<head>` w `Layout.astro` z cache-bust `?v=2`. **Non-goals:** pełny zestaw PWA (service worker, manifest 192/512); redesign logo w topbarze; animowane favicon.

## Backlog Handoff

| Roadmap ID | Change ID             | Suggested issue title                                                    | Ready for `/10x-plan` | Notes                                                         |
| ---------- | --------------------- | ------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------- |
| F-01       | data-schema-rls       | Design and apply Supabase schema + RLS for flashcard_sets and flashcards | —                     | **done** — archived `context/archive/2026-05-26-data-schema-rls/` |
| F-02       | deploy-pipeline       | Wire GitHub Actions deploy job for Cloudflare Workers                    | —                     | **done** — archived `context/archive/2026-06-08-deploy-pipeline/` |
| S-01       | flashcard-sets-ui       | Flashcard set management: create and browse sets                         | —                     | **done** — archived `context/archive/2026-05-26-flashcard-sets-ui/` |
| S-05       | set-dashboard-lifecycle | Dashboard: rename set + delete set (empty or with cards)                 | —                     | **done** — archived `context/archive/2026-05-28-set-dashboard-lifecycle/` |
| S-02       | ai-generation-save      | AI generation: paste text → preview cards → save to set                    | —                     | **done** — archived `context/archive/2026-05-27-ai-generation-save/` |
| S-03       | manual-flashcard-crud   | Manual flashcard CRUD: add, edit, delete cards in a set                    | —                     | **done** — archived `context/archive/2026-05-27-manual-flashcard-crud/` |
| S-04       | srs-review-session      | SRS review session: start session + auto-schedule next review              | —                     | **done** — archived `context/archive/2026-05-27-srs-review-session/` |
| S-06       | account-deletion        | Account deletion: confirm and purge user data + auth account               | —                     | **done** — archived `context/archive/2026-05-28-account-deletion/` |
| S-07       | study-hub-ui            | Study hub + landing + set detail paper theme (review UI later)               | —                     | **done** — archived `context/archive/2026-05-29-study-hub-ui/` |
| S-08       | unified-paper-ui        | Unified paper UI: review, settings, auth + full route audit                  | —                     | **done** — archived `context/archive/2026-05-30-unified-paper-ui/` |
| S-09       | bilingual-ui            | Bilingual UI (PL/EN): landing selector, browser default, locked after login  | —                     | **done** — archived `context/archive/2026-05-30-bilingual-ui/` |
| S-10       | app-icon-favicon        | App icon + favicon: agent-generated icon for browser tab and home screen       | —                     | **done** — archived `context/archive/2026-06-08-app-icon-favicon/` |

## Open Roadmap Questions

1. **Bramka rejestracji przy onboardingu** — Czy pierwszy gość może spróbować generowania AI przed założeniem konta, z rejestracją odłożoną na moment pierwszego zapisu? Owner: user. Block: S-02 (decyzja wpływa na przepływ tuż przed akcją "zapisz do zestawu").

## Parked

- **Import plików (PDF, DOCX, TXT, PPTX)** — Why parked: PRD §Non-Goals; parsowanie zewnętrznych dokumentów dodaje dużą powierzchnię niewymaganą do walidacji wartości rdzenia.
- **Funkcje społecznościowe i udostępnianie zestawów** — Why parked: PRD §Non-Goals; zestawy są prywatne w zakresie MVP.
- **Integracje z zewnętrznymi platformami (Quizlet, LMS, Notion, API)** — Why parked: PRD §Non-Goals.
- **Natywne aplikacje mobilne (iOS / Android)** — Why parked: PRD §Non-Goals; web-only w MVP z responsywnym layoutem.
- **Observability na poziomie aplikacji (Sentry, OTel, itp.)** — Why parked: brak NFR wymagającego tego przy launchie; Cloudflare Workers observability wystarczy na MVP.

## Done

- **F-01: (foundation) tabele aplikacji (`flashcard_sets`, `flashcards` z polami SRS) zamigrowane w Supabase; polityki RLS gwarantują, że każdy użytkownik widzi wyłącznie własne zestawy — schemat gotowy do odczytu i zapisu przez wszystkie slice'y.** — Archived 2026-06-05 → `context/archive/2026-05-26-data-schema-rls/`. Lesson: —.
- **S-02: Generowanie AI + zapis** — Archived 2026-06-05 → `context/archive/2026-05-27-ai-generation-save/`. Lesson: —.
- **S-04: Sesja powtórkowa SRS** — Archived 2026-06-01 → `context/archive/2026-05-27-srs-review-session/`. Lesson: —.
- **S-07: Study hub — redesign dashboardu** — Archived 2026-06-01 → `context/archive/2026-05-29-study-hub-ui/`. Lesson: —.
- **S-08: Unified paper UI — pełna spójność wizualna** — Archived 2026-06-01 → `context/archive/2026-05-30-unified-paper-ui/`. Lesson: —.
- **S-09: Dwujęzyczny interfejs (PL / EN)** — Archived 2026-06-01 → `context/archive/2026-05-30-bilingual-ui/`. Lesson: —.
- **F-02: (foundation) zadanie deploy w GitHub Actions uruchamia `wrangler deploy` po każdym merge do master; każdy slice może trafić na produkcję bez ręcznych kroków.** — Archived 2026-06-08 → `context/archive/2026-06-08-deploy-pipeline/`. Lesson: —.
- **S-10: użytkownik widzi spójną ikonę 10xCards w zakładce przeglądarki (favicon) oraz przy dodawaniu aplikacji do ekranu głównego (apple-touch-icon); ikona jest wygenerowana przez agenta AI i dopasowana do paper theme (Instrument Serif / DM Sans, paleta primary, motyw fiszek / nauki).** — Archived 2026-06-08 → `context/archive/2026-06-08-app-icon-favicon/`. Lesson: —.
- **S-01: użytkownik może tworzyć nowy nazwany zestaw fiszek i przeglądać listę wszystkich swoich zestawów po zalogowaniu.** — Archived 2026-06-08 → `context/archive/2026-05-26-flashcard-sets-ui/`. Lesson: —.
- **S-03: użytkownik może ręcznie dodać nową fiszkę do zestawu, edytować pytanie lub odpowiedź istniejącej fiszki i usunąć fiszkę ze zbioru.** — Archived 2026-06-08 → `context/archive/2026-05-27-manual-flashcard-crud/`. Lesson: —.
- **S-05: użytkownik może z listy zestawów na `/dashboard` zmienić nazwę zestawu oraz usunąć zestaw — pusty jednym kliknięciem, z fiszkami po potwierdzeniu.** — Archived 2026-06-08 → `context/archive/2026-05-28-set-dashboard-lifecycle/`. Lesson: —.
- **S-06: użytkownik może z poziomu ustawień konta trwale usunąć konto po potwierdzeniu; system usuwa konto w Supabase Auth oraz wszystkie powiązane zestawy i fiszki.** — Archived 2026-06-08 → `context/archive/2026-05-28-account-deletion/`. Lesson: —.

**Next up:** brak otwartych slice'ów MVP w roadmapie. Kolejny krok jakościowy: `context/foundation/test-plan.md` (rollout testów).
