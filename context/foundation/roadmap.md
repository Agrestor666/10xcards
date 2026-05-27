---
project: "10xCards"
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-25
prd_version: 1
main_goal: speed
top_blocker: capacity
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
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
| S-02 | ai-generation-save    | wkleić tekst, zobaczyć fiszki AI, zaakceptować / edytować / usunąć i zapisać do zestawu                                | F-01, S-01    | FR-004, FR-005, US-01                        | proposed |
| S-03 | manual-flashcard-crud | ręcznie dodać, edytować i usunąć fiszkę w zestawie                                                                     | F-01, S-01    | FR-006, FR-008, FR-009, US-02                | proposed |
| S-04 | srs-review-session    | rozpocząć sesję powtórkową SRS i zobaczyć, że system automatycznie planuje kolejną datę przeglądu po każdej odpowiedzi | F-01, S-01    | FR-010, FR-011, US-01                        | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                    | Note                                                                           |
| ------ | -------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| A      | Krytyczna ścieżka AI | `F-01` → `S-01` → `S-02` | Gwiazda przewodnia; cel `speed` każe dotrzeć tu jak najszybciej.               |
| B      | Ręczne CRUD fiszek   | `S-03`                   | Dołącza do Streamu A przy `S-01`; równoległy z S-02 i S-04.                    |
| C      | Sesja SRS            | `S-04`                   | Dołącza do Streamu A przy `S-01`; równoległy z S-02 i S-03.                    |
| D      | Pipeline deploymentu | `F-02`                   | Niezależna; nie blokuje żadnego slice'a, ale umożliwia release każdego z nich. |

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
- **Unlocks:** S-01, S-02, S-03, S-04
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

## Backlog Handoff

| Roadmap ID | Change ID             | Suggested issue title                                                    | Ready for `/10x-plan` | Notes                                                         |
| ---------- | --------------------- | ------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------- |
| F-01       | data-schema-rls       | Design and apply Supabase schema + RLS for flashcard_sets and flashcards | yes                   | Run `/10x-plan data-schema-rls`                               |
| F-02       | deploy-pipeline       | Wire GitHub Actions deploy job for Cloudflare Workers                    | yes                   | Run `/10x-plan deploy-pipeline`; parallel with F-01           |
| S-01       | flashcard-sets-ui     | Flashcard set management: create and browse sets                         | no                    | Requires F-01 done first                                      |
| S-02       |    | AI generation: paste text → preview cards → save to set    ai-generation-save               | no                    | Requires F-01 + S-01 done; north star slice                   |
| S-03       | manual-flashcard-crud | Manual flashcard CRUD: add, edit, delete cards in a set                  | no                    | Requires F-01 + S-01 done; parallel with S-02                 |
| S-04       | srs-review-session    | SRS review session: start session + auto-schedule next review            | no                    | Requires F-01 + S-01 done; decide SRS library before planning |

## Open Roadmap Questions

1. **Bramka rejestracji przy onboardingu** — Czy pierwszy gość może spróbować generowania AI przed założeniem konta, z rejestracją odłożoną na moment pierwszego zapisu? Owner: user. Block: S-02 (decyzja wpływa na przepływ tuż przed akcją "zapisz do zestawu").

## Parked

- **Import plików (PDF, DOCX, TXT, PPTX)** — Why parked: PRD §Non-Goals; parsowanie zewnętrznych dokumentów dodaje dużą powierzchnię niewymaganą do walidacji wartości rdzenia.
- **Funkcje społecznościowe i udostępnianie zestawów** — Why parked: PRD §Non-Goals; zestawy są prywatne w zakresie MVP.
- **Integracje z zewnętrznymi platformami (Quizlet, LMS, Notion, API)** — Why parked: PRD §Non-Goals.
- **Natywne aplikacje mobilne (iOS / Android)** — Why parked: PRD §Non-Goals; web-only w MVP z responsywnym layoutem.
- **Observability na poziomie aplikacji (Sentry, OTel, itp.)** — Why parked: brak NFR wymagającego tego przy launchie; Cloudflare Workers observability wystarczy na MVP.

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)
