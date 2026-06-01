---
project: "10xCards"
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-01
prd_version: 1
prd_v2_slice: S-05
shape_notes_slice: S-07
prd_v3_slice: S-07
main_goal: speed
top_blocker: capacity
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
| F-01 | data-schema-rls       | (foundation) tabele aplikacji i polityki RLS lądują w Supabase; każda warstwa odczytu i zapisu ma bezpieczną bazę      | —             | NFR trwałość, NFR prywatność, Access Control | ready    |
| F-02 | deploy-pipeline       | (foundation) pipeline CI/CD do Cloudflare Workers; merge do master = automatyczny release                              | —             | —                                            | ready    |
| S-01 | flashcard-sets-ui     | tworzyć i przeglądać własne zestawy fiszek po zalogowaniu                                                              | F-01          | FR-001, FR-002, FR-003, FR-007               | proposed |
| S-05 | set-dashboard-lifecycle | zmienić nazwę zestawu i usunąć zestaw (pusty lub z fiszkami) z listy na dashboardzie                                 | F-01, S-01    | prd-v2 Scope [new], US-01                    | proposed |
| S-02 | ai-generation-save    | wkleić tekst, zobaczyć fiszki AI, zaakceptować / edytować / usunąć i zapisać do zestawu                                | F-01, S-01    | FR-004, FR-005, US-01                        | proposed |
| S-03 | manual-flashcard-crud | ręcznie dodać, edytować i usunąć fiszkę w zestawie                                                                     | F-01, S-01    | FR-006, FR-008, FR-009, US-02                | proposed |
| S-04 | srs-review-session    | rozpocząć sesję powtórkową SRS i zobaczyć, że system automatycznie planuje kolejną datę przeglądu po każdej odpowiedzi | F-01, S-01    | FR-010, FR-011, US-01                        | proposed |
| S-06 | account-deletion      | trwale usunąć swoje konto wraz ze wszystkimi zestawami i fiszkami (po potwierdzeniu)                                   | F-01          | NFR prywatność, Access Control               | planned  |
| S-07 | study-hub-ui          | study hub na `/dashboard` + landing `/` + paper theme na `/sets/<id>`; due dziś, **Study**, kafelki zestawów | F-01, S-01, S-02, S-04, S-05 | prd-v3, US-01–US-04, landing-copy.md | proposed |
| S-08 | unified-paper-ui      | cała aplikacja w jednym stylu paper (review, settings, auth); brak skoków cosmic ↔ paper między ekranami | S-07 | study-hub-ui plan, paper tokens | proposed |
| S-09 | bilingual-ui          | cała aplikacja po polsku lub po angielsku; wybór języka na landingu (domyślnie z przeglądarki); po zalogowaniu bez zmiany | S-07, S-08 | shape-notes (ex-i18n non-goal), landing-copy.md | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                    | Note                                                                           |
| ------ | -------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| A      | Krytyczna ścieżka AI | `F-01` → `S-01` → `S-02` | Gwiazda przewodnia; cel `speed` każe dotrzeć tu jak najszybciej.               |
| A′     | Lifecycle zestawów   | `S-05`                   | Rozszerza `S-01` na dashboardzie (rename/delete); `prd-v2`; równoległy z S-02–S-04. |
| B      | Ręczne CRUD fiszek   | `S-03`                   | Dołącza do Streamu A przy `S-01`; równoległy z S-02, S-04 i S-05.              |
| C      | Sesja SRS            | `S-04`                   | Dołącza do Streamu A przy `S-01`; równoległy z S-02, S-03 i S-05.               |
| D      | Pipeline deploymentu | `F-02`                   | Niezależna; nie blokuje żadnego slice'a, ale umożliwia release każdego z nich. |
| E      | Konto / compliance   | `S-06`                   | Usunięcie konta i danych użytkownika; zależy tylko od `F-01`; równoległy z S-01–S-05. |
| F      | Dashboard / study hub | `S-07`                  | Paper theme: `/dashboard`, `/`, `/sets/<id>`; due today, kafelki; review UI poza slice; bez migracji DB. |
| G      | Spójność UI           | `S-08`                  | Pełny rollout paper theme na review, settings, auth; deprecacja cosmic `Topbar`; jeden styl na wszystkich trasach. |
| H      | Dwujęzyczność UI      | `S-09`                  | PL + EN; wybór na landingu; domyślny język z `Accept-Language`; po zalogowaniu locale zablokowany — bez przełącznika w ustawieniach. |

## Baseline

What's already in place in the codebase as of `2026-05-25` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + shadcn/ui + Tailwind CSS 4; komponenty wyrenderowane w stronach (`src/pages/index.astro`, `src/pages/auth/signin.astro`)
- **Backend / API:** present — trasy API Astro wdrożone (`src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`)
- **Data:** partial — klient Supabase JS wdrożony (`src/lib/supabase.ts`); brak migracji schematu (`supabase/migrations/` nieobecny)
- **Auth:** present — Supabase SSR auth w pełni wdrożony: trasy API logowania/rejestracji/wylogowania, sesje cookie, middleware chroniący trasy
- **Deploy / infra:** partial — cel Cloudflare Workers ustawiony (`wrangler.jsonc`), pipeline CI lint+build (`.github/workflows/ci.yml`); brak zadania deploy
- **Observability:** partial — platforma Cloudflare observability włączona (`wrangler.jsonc`); brak logowania i śledzenia błędów na poziomie aplikacji

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
- **Status:** ready

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
- **Status:** ready

## Slices

### S-01: Zestawy fiszek

- **Outcome:** użytkownik może tworzyć nowy nazwany zestaw fiszek i przeglądać listę wszystkich swoich zestawów po zalogowaniu.
- **Change ID:** flashcard-sets-ui
- **PRD refs:** FR-001, FR-002, FR-003, FR-007, US-01 (prereq: "logged-in user with at least one named flashcard set")
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Fundament nawigacyjny pod każdy kolejny slice; błąd w routingu lub w warstwach danych zestawów będzie multiplikował się we wszystkich następnych historyjkach.
- **Status:** proposed

### S-05: Lifecycle zestawów na dashboardzie

- **Outcome:** użytkownik może z listy zestawów na `/dashboard` zmienić nazwę zestawu (literówka / mylący tytuł) oraz usunąć zestaw — pusty jednym kliknięciem, z fiszkami po potwierdzeniu z liczbą kart do usunięcia.
- **Change ID:** set-dashboard-lifecycle
- **PRD refs:** `prd-v2.md` — Scope of Change [new] (rename, delete empty, delete with cards), US-01; Success Criteria Primary/Secondary
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niski — RLS i kaskada usuwania fiszek już w schemacie; ryzyko regresji na CRUD kart, AI i SRS przy testach ręcznych (brak Vitest w projekcie — patrz `health-check.md`).
- **Status:** proposed

> Uzupełnia S-01 o brakujące operacje na poziomie zestawu. Non-goals: rename/delete na `/sets/<id>`, kosz, bulk delete (`prd-v2` §Non-Goals).

### S-02: Generowanie AI + zapis

- **Outcome:** użytkownik może wkleić surowy tekst, zobaczyć wygenerowane przez AI pary pytanie-odpowiedź, zaakceptować / edytować inline / usunąć pojedyncze karty i zapisać zaakceptowane do wybranego zestawu.
- **Change ID:** ai-generation-save
- **PRD refs:** FR-004, FR-005, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Projekt promptu dla OpenRouter: model, format odpowiedzi JSON, obsługa wielojęzyczności — Owner: user. Block: no (decyzja implementacyjna; sensowny default wystarczy do startu, można iterować).
- **Risk:** Latencja AI i limity CPU Cloudflare Workers to dwa niezależne wektory ryzyka — NFR <10s może nie zmieścić się na darmowym planie Workers; warto przetestować na docelowym planie rozliczeniowym przed releasem.
- **Status:** proposed

### S-03: Ręczne tworzenie i CRUD fiszek

- **Outcome:** użytkownik może ręcznie dodać nową fiszkę do zestawu, edytować pytanie lub odpowiedź istniejącej fiszki i usunąć fiszkę ze zbioru.
- **Change ID:** manual-flashcard-crud
- **PRD refs:** FR-006, FR-008, FR-009, US-02
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Klasyczne CRUD na istniejącym schemacie — małe ryzyko. Uwaga: edycja inline w S-02 i edycja post-save w S-03 używają podobnego UI; warto wydzielić wspólny komponent, żeby nie duplikować logiki.
- **Status:** proposed

### S-04: Sesja powtórkowa SRS

- **Outcome:** użytkownik może rozpocząć sesję powtórkową dla wybranego zestawu; po każdej odpowiedzi system automatycznie aktualizuje datę następnego przeglądu karty na podstawie algorytmu SRS.
- **Change ID:** srs-review-session
- **PRD refs:** FR-010, FR-011, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:**
  - Wybór biblioteki SRS (SM-2, FSRS / ts-fsrs lub inna) — Owner: user. Block: no (PRD dopuszcza "pre-existing SRS library"; wybór jest implementacyjny i nie blokuje planowania roadmapy, ale warto zdecydować przed `/10x-plan srs-review-session`).
- **Risk:** Pola harmonogramu SRS (`interval`, `ease_factor`, `due_date`) muszą pasować do wybranej biblioteki — najlepiej potwierdzić wybór biblioteki podczas planowania F-01 (schema), aby nie migrować kolumn po fakcie.
- **Status:** proposed

### S-06: Usunięcie konta

- **Outcome:** użytkownik może z poziomu ustawień konta trwale usunąć konto po potwierdzeniu; system usuwa konto w Supabase Auth oraz wszystkie powiązane zestawy i fiszki (kaskada / RLS).
- **Change ID:** account-deletion
- **PRD refs:** NFR prywatność, Access Control ("zestawy fiszek są prywatne — widoczne tylko dla właściciela konta")
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Czy wymagane ponowne wpisanie hasła lub fraza potwierdzająca przed usunięciem — Owner: user. Block: no (domyślnie modal z potwierdzeniem wystarczy do MVP).
- **Risk:** Usunięcie konta w Supabase Auth vs. kaskada danych aplikacji — trzeba zapewnić atomowość lub jasną kolejność (najpierw dane aplikacji, potem `auth.users`), żeby nie zostawić osieroconych wierszy; wymóg compliance (RODO) sugeruje brak soft-delete w MVP.
- **Status:** planned

### S-07: Study hub — redesign dashboardu

- **Outcome:** użytkownik po zalogowaniu na `/dashboard` widzi due dziś i **Study** z kafelka; zarządza zestawami (kafelki, + New set, ⋯); generator AI + sync liczników bez regresji. Gość na `/` widzi landing 10xCards (AI + SRS, copy w `landing-copy.md`). Na `/sets/<id>` — ten sam paper theme, CRUD fiszek i **Start review** bez zmian funkcjonalnych. Sesja `/sets/<id>/review` — funkcja bez zmian, styl może zostać na później.
- **Change ID:** study-hub-ui
- **PRD refs:** `prd-v3.md` — Scope of Change, US-01–US-02; źródło kształtu: `shape-notes.md`, `dashboard-redesign-proposal.md`
- **Prerequisites:** F-01, S-01, S-02, S-04, S-05 (SRS `due_at`, generator na dashboardzie, lifecycle zestawów)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:**
  - Dokładny kształt zapytania SSR `due_count` per zestaw (PostgREST aggregate vs. osobne query) — Owner: implementer przy `/10x-plan`. Block: no.
  - Fonty paper theme (np. Instrument Serif + DM Sans) — Owner: user/plan. Block: no.
  - Copy hero: `context/changes/study-hub-ui/landing-copy.md` (domyślne EN).
- **Risk:** Wyższy — paper theme na dashboard + landing + set detail; review/settings/auth celowo poza slice → **S-08**; brak testów auto. ~3 tyg. after-hours raczej ciasno — fazowanie: (1) tokeny + dashboard, (2) landing + set detail.
- **Status:** proposed

> Non-goals (slice): **pełna i18n PL/EN** (→ **S-09**), **redesign UI sesji review** (funkcja SRS bez zmian), migracje DB, glassmorphism. W scope: landing + `/sets/<id>` paper theme (2026-05-30). Copy: `landing-copy.md`. Pełna unifikacja UI (review, settings, auth) → **S-08**.

### S-08: Unified paper UI — pełna spójność wizualna

- **Outcome:** użytkownik porusza się po całej aplikacji bez zmiany „skórki” — wszystkie ekrany używają paper theme (`PaperShell`, `AppTopbar`, tokeny z Phase 1 S-07): landing `/`, dashboard, set detail, **sesja review** `/sets/<id>/review`, **ustawienia** `/settings`, **auth** `/auth/signin`, `/auth/signup`, `/auth/confirm-email`. Stary cosmic `Topbar.astro` i `bg-cosmic` zostają zastąpione lub ograniczone do legacy wyjątków (np. dev-only). Funkcje SRS, CRUD, auth i account deletion bez regresji — zmiana wyłącznie warstwy prezentacji.
- **Change ID:** unified-paper-ui
- **PRD refs:** NFR użyteczność; spójność produktu 10xCards (`prd-v3`, `shape-notes`); kontynuacja non-goal S-07 (review/settings/auth) jako osobny slice
- **Prerequisites:** S-07 (paper tokens, `PaperShell`, `AppTopbar`, dashboard + landing + set detail ukończone)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:**
  - Czy zachować `bg-cosmic` jako utility dla ewentualnych marketingowych one-offów — Owner: implementer przy `/10x-plan`. Block: no (domyślnie: usunąć z tras użytkownika, zostawić w CSS tylko jeśli potrzebne).
  - Zakres re-skinu komponentów React (review card, grade buttons, auth forms) vs. same strony Astro — Owner: implementer. Block: no.
- **Risk:** Średni — dotyka wielu plików i islandów React; sesja SRS wymaga ostrożności (nie zmieniać logiki grading). Warto fazować: (1) impl-review wszystkich tras + inventory cosmic classes, (2) auth + settings, (3) review UI, (4) cleanup `Topbar.astro` / dev preview / martwe style.
- **Status:** proposed

> Scope (planowane trasy): `index.astro`, `dashboard.astro`, `sets/[id]/index.astro`, `sets/[id]/review.astro`, `settings.astro`, `auth/*.astro`, wspólne komponenty (`SignInForm`, review UI, `FlashcardRow` theme default → paper). Non-goals: zmiany algorytmu SRS, migracje DB, **pełna i18n PL** (→ **S-09**), nowe funkcje.

### S-09: Dwujęzyczny interfejs (PL / EN)

- **Outcome:** gość na landingu `/` wybiera język interfejsu — **polski** lub **angielski** — albo dostaje domyślny na podstawie języka przeglądarki / systemu (`Accept-Language`, fallback EN). Po wyborze cała aplikacja (landing, auth, dashboard, zestawy, review, ustawienia, komunikaty błędów UI) renderuje się w tym języku. **Po zalogowaniu użytkownik nie może zmienić języka** — brak przełącznika w `/settings` ani w topbarze; wybrany locale jest trwały dla sesji / konta (szczegóły persystencji → `/10x-plan`).
- **Change ID:** bilingual-ui
- **PRD refs:** `shape-notes.md` (wcześniejszy non-goal i18n — superseded przez ten slice); `landing-copy.md` (EN jako baza tłumaczeń); NFR użyteczność (polski rynek docelowy)
- **Prerequisites:** S-07 (landing + dashboard + copy), S-08 (wszystkie trasy użytkownika w finalnym UI — tłumaczenie raz, na spójnym paper theme)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:**
  - Mechanizm i18n (Astro + React islands): np. prosty słownik + helper `t()`, vs. biblioteka (`paraglide`, `i18next`) — Owner: implementer przy `/10x-plan`. Block: no.
  - Persystencja locale: wyłącznie cookie vs. zapis w profilu użytkownika (Supabase `user_metadata`) przy rejestracji — Owner: user/plan. Block: no (wymóg: brak zmiany po logowaniu; oba modele spełniają, jeśli snapshot przy signup).
  - Wejście na `/auth/signin` bez wizyty na landingu — domyślny język z `Accept-Language`, bez późniejszej zmiany po zalogowaniu — Owner: implementer. Block: no.
  - Zakres tłumaczeń komunikatów API (JSON errors) vs. tylko UI — Owner: user. Block: no (MVP: UI + najczęstsze błędy formularzy).
- **Risk:** Średni — dotyka wszystkich tras i islandów React; ryzyko pominiętych stringów (regresja EN-only). Warto fazować: (1) infrastruktura locale + landing selector + cookie/metadata, (2) auth + landing, (3) dashboard + set + review + settings, (4) audyt stringów + smoke obu języków.
- **Status:** done

> **Scope:** selektor PL | EN na landingu; auto-detect `Accept-Language` (mapowanie `pl*` → PL, inaczej EN); propagacja locale do SSR i React; tłumaczenie istniejącego copy (dashboard, generator, SRS, auth, account deletion UI). **Non-goals:** więcej niż 2 języki; przełącznik języka po zalogowaniu; tłumaczenie treści fiszek generowanych przez AI (język fiszek = język źródłowego tekstu użytkownika); pełna lokalizacja dat/liczb poza `toLocaleString` tam gdzie już jest.

## Backlog Handoff

| Roadmap ID | Change ID             | Suggested issue title                                                    | Ready for `/10x-plan` | Notes                                                         |
| ---------- | --------------------- | ------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------- |
| F-01       | data-schema-rls       | Design and apply Supabase schema + RLS for flashcard_sets and flashcards | yes                   | Run `/10x-plan data-schema-rls`                               |
| F-02       | deploy-pipeline       | Wire GitHub Actions deploy job for Cloudflare Workers                    | yes                   | Run `/10x-plan deploy-pipeline`; parallel with F-01           |
| S-01       | flashcard-sets-ui       | Flashcard set management: create and browse sets                         | no                    | Requires F-01 done first                                      |
| S-05       | set-dashboard-lifecycle | Dashboard: rename set + delete set (empty or with cards)                 | yes                   | Run `/10x-plan set-dashboard-lifecycle`; requires S-01; `prd-v2` |
| S-02       | ai-generation-save      | AI generation: paste text → preview cards → save to set                    | no                    | Requires F-01 + S-01 done; north star slice                   |
| S-03       | manual-flashcard-crud   | Manual flashcard CRUD: add, edit, delete cards in a set                    | no                    | Requires F-01 + S-01 done; parallel with S-02                 |
| S-04       | srs-review-session      | SRS review session: start session + auto-schedule next review              | no                    | Requires F-01 + S-01 done; decide SRS library before planning |
| S-06       | account-deletion        | Account deletion: confirm and purge user data + auth account               | no                    | Requires F-01 done first; parallel with feature slices        |
| S-07       | study-hub-ui            | Study hub + landing + set detail paper theme (review UI later)               | yes                   | Run `/10x-plan study-hub-ui`; PRD `prd-v3.md`; copy `landing-copy.md` |
| S-08       | unified-paper-ui        | Unified paper UI: review, settings, auth + full route audit                  | no                    | Requires S-07 done first; run `/10x-plan unified-paper-ui` after S-07 archive |
| S-09       | bilingual-ui            | Bilingual UI (PL/EN): landing selector, browser default, locked after login  | no                    | Requires S-07 + S-08; run `/10x-plan bilingual-ui` after S-08 archive         |

## Open Roadmap Questions

1. **Bramka rejestracji przy onboardingu** — Czy pierwszy gość może spróbować generowania AI przed założeniem konta, z rejestracją odłożoną na moment pierwszego zapisu? Owner: user. Block: S-02 (decyzja wpływa na przepływ tuż przed akcją "zapisz do zestawu").

## Parked

- **Import plików (PDF, DOCX, TXT, PPTX)** — Why parked: PRD §Non-Goals; parsowanie zewnętrznych dokumentów dodaje dużą powierzchnię niewymaganą do walidacji wartości rdzenia.
- **Funkcje społecznościowe i udostępnianie zestawów** — Why parked: PRD §Non-Goals; zestawy są prywatne w zakresie MVP.
- **Integracje z zewnętrznymi platformami (Quizlet, LMS, Notion, API)** — Why parked: PRD §Non-Goals.
- **Natywne aplikacje mobilne (iOS / Android)** — Why parked: PRD §Non-Goals; web-only w MVP z responsywnym layoutem.
- **Observability na poziomie aplikacji (Sentry, OTel, itp.)** — Why parked: brak NFR wymagającego tego przy launchie; Cloudflare Workers observability wystarczy na MVP.

## Done

- **S-09: Dwujęzyczny interfejs (PL / EN)** — Archived 2026-06-01 → `context/archive/2026-05-30-bilingual-ui/`. Lesson: —.

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)
