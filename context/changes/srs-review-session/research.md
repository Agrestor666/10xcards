---
date: 2026-05-27T22:20:00+02:00
researcher: Auto (Cursor)
git_commit: e794b9d0ec27b7130019f418a5d55a629937d83d
branch: master
repository: Agrestor666/10xcards
topic: "ts-fsrs@latest compatibility with 10xCards codebase and fitness as SRS library choice for S-04"
tags: [research, srs, ts-fsrs, flashcards, s-04, cloudflare-workers]
status: complete
last_updated: 2026-05-27
last_updated_by: Auto (Cursor)
---

# Research: ts-fsrs compatibility and library choice for srs-review-session

**Date**: 2026-05-27T22:20:00+02:00  
**Researcher**: Auto (Cursor)  
**Git Commit**: `e794b9d0ec27b7130019f418a5d55a629937d83d`  
**Branch**: `master`  
**Repository**: [Agrestor666/10xcards](https://github.com/Agrestor666/10xcards)

## Research Question

Czy najnowsza wersja biblioteki **ts-fsrs** jest kompatybilna z naszym kodem, i czy to dobry wybór dla slice'a S-04 (`srs-review-session`)?

## Summary

**Tak — `ts-fsrs@5.4.1` (FSRS-6, maj 2026) jest kompatybilna z obecnym kodem i schematem DB, i jest rekomendowanym wyborem dla S-04.**

| Aspekt | Werdykt |
|--------|---------|
| **Kompatybilność ze schematem F-01** | Pełna — `due_at` + `srs_state` JSONB zostały zaprojektowane pod algorytm zewnętrzny; FSRS mapuje się bez migracji SM-2 |
| **Kompatybilność z istniejącym kodem** | Brak konfliktu — biblioteka nie jest jeszcze zainstalowana; CRUD nie modyfikuje `srs_state` |
| **Runtime (Node / Workers)** | Zgodne — Node 22.14.0 (`.nvmrc`), `nodejs_compat` w `wrangler.jsonc`; pakiet bez zależności runtime (~60 KB ESM) |
| **PRD FR-010 / FR-011** | Spełnione przez `repeat()` + `next()` i persist `due_at` po ocenie |
| **Dobry wybór vs alternatywy** | Tak — PRD preferuje gotową implementację; TS-native FSRS-6 lepszy niż własny SM-2 lub binding WASM na Workers |

**Główne prace integracyjne (nie blokery):** warstwa mapowania DB ↔ `Card`, serializacja `Date`, `npm install ts-fsrs@5.4.1`, nowe trasy API + UI sesji. Nie używać `@open-spaced-repetition/binding` w ścieżce review na Workers.

## Detailed Findings

### 1. Stan kodu — brak integracji SRS (greenfield)

- `package.json` **nie zawiera** `ts-fsrs` — integracja od zera, brak ryzyka breaking change w istniejącym kodzie.
- Żaden plik w `src/` nie importuje FSRS ani nie wywołuje schedulera.
- API mutacji fiszek (`create`, `update`, `bulk-create`, `delete`) operuje na `question` / `answer`; insert polega na domyślnych DB (`srs_state = '{}'`, `due_at = now()`).
- `loadSetDetailPage` **nie pobiera** `due_at` ani `srs_state` — lista zestawu nie dotyka SRS (celowo; S-04 doda osobną ścieżkę sesji).

**Wniosek:** Najnowsze API ts-fsrs 5.x nie „psuje” istniejącego kodu — trzeba go dopiero dodać.

### 2. Schemat bazy — zgodność z FSRS-6

Migracja F-01 (`supabase/migrations/20260526211944_flashcard_schema.sql`):

- `due_at timestamptz NOT NULL DEFAULT now()` — indeks `(set_id, due_at)` pod zapytanie sesji `due_at <= now()`.
- `srs_state jsonb NOT NULL DEFAULT '{}'::jsonb` — komentarz SQL: stan algorytmu jest własnością S-04.

Plan F-01 (`context/changes/data-schema-rls/plan.md`) jawnie unika pól SM-2 (`interval`, `ease_factor`) i deleguje kształt JSON do S-04. Roadmap S-04 wspomina SM-2 jako ryzyko nazewnictwa — **przy FSRS nie ma migracji kolumn**.

Proponowane mapowanie (z `ts-fsrs.md`, zgodne z `Card` w ts-fsrs 5.4.x):

| DB | FSRS `Card` |
|----|-------------|
| `due_at` | `due` (źródło prawdy do sortowania) |
| `srs_state` | `stability`, `difficulty`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review` |

Puste `{}` przy pierwszej sesji → `createEmptyCard(now)` przed `next()`.

### 3. Typy i kontrakty aplikacji

`src/types.ts` definiuje `Flashcard` z `srs_state: Record<string, unknown>` i `due_at: string` — wystarczające na adapter; warto później dodać `SrsState` (opcjonalne, nie wymóg biblioteki).

S-03 plan (`context/changes/manual-flashcard-crud/plan.md`) wymaga, aby update/delete **nie zmieniały** `srs_state` / `due_at` — zgodne z FSRS (stan zmienia tylko endpoint sesji).

### 4. ts-fsrs@5.4.1 — wymagania techniczne

| Wymaganie | Projekt | Status |
|-----------|---------|--------|
| Node `>=20` | `.nvmrc` → 22.14.0 | OK |
| ESM / bundler | Astro 6 + Vite | OK (`import { fsrs } from 'ts-fsrs'`) |
| Zależności runtime | 0 (npm) | OK na Cloudflare Workers |
| Rozmiar | ~59 KB ESM | Akceptowalne dla API route |
| Algorytm | FSRS-6 (od 5.0.0) | Nowszy niż SM-2; `learning_steps` na karcie od 5.0 |

**Uwagi wersji 5.x (istotne przy implementacji, nie przy kompatybilności wstecznej):**

- `Card.elapsed_days` / pola w `ReviewLog` oznaczone **@deprecated** (usunięcie w ts-fsrs v6.0) — nie traktować jako źródła prawdy w `srs_state`.
- 5.4.x dodaje `FSRSValidationError` — sensowne mapowanie błędów w API przy złym `Rating`.
- Nie integrować `@open-spaced-repetition/binding` (WASM optimizer) w Workerze sesji — osobny pakiet, cięższy; do MVP wystarczy `ts-fsrs`.

### 5. Cloudflare Workers / Astro SSR

`context/foundation/infrastructure.md` — deploy na Workers z `nodejs_compat`. ts-fsrs to czysty TS/JS bez native addons — **kompatybilne z workerd**, analogicznie do innych zależności w bundle (zod, supabase-js po stronie serwera).

Wzorzec integracji SRS: **logika schedulera wyłącznie w API routes** (`export const prerender = false`), nie w kliencie — chroni spójność i nie eksponuje szczegółów algorytmu (opcjonalnie preview `repeat()` może być server-side lub po fetch).

### 6. Wzorce kodu do naśladowania w S-04

| Obszar | Wzorzec | Plik |
|--------|---------|------|
| API JSON | zod → auth → Supabase → `{ ok, message }` | `src/pages/api/flashcards/create.ts` |
| Odpowiedzi | `jsonResponse()` | `src/lib/api-json.ts` |
| Strona zestawu | SSR loader + React island | `src/pages/sets/[id].astro`, `SetFlashcardsManager` |
| Ochrona tras | `PROTECTED_ROUTES` | `src/middleware.ts` — rozszerzyć o `/sets/*/review` lub podobnie |
| Błędy DB | mapery komunikatów | `src/lib/flashcard-errors.ts` |

### 7. PRD i produkt — czy FSRS / ts-fsrs to dobry wybór?

**PRD** (`context/foundation/prd.md`):

- FR-010: sesja powtórkowa dla zestawu — must-have.
- FR-011: auto-harmonogram po odpowiedzi — must-have; **Socrates resolution:** użyć gotowej implementacji algorytmu zamiast własnego.

**Porównanie opcji:**

| Opcja | Zalety | Wady dla 10xCards |
|-------|--------|-------------------|
| **ts-fsrs@5.4.1** | TS-native, FSRS-6, utrzymywany (OSR), 0 deps, API `repeat`/`next`, pasuje do JSONB | Wymaga mappera Date/JSON |
| **Własny SM-2** | Prosty model kolumn SM-2 | Konflikt ze schematem F-01; więcej kodu; gorsza jakość schedulingu vs FSRS |
| **py-fsrs / inny język** | — | Zły fit (stack TS end-to-end) |
| **@open-spaced-repetition/binding** | Optymalizacja parametrów | WASM, overkill na MVP Workers |
| **Brak biblioteki (fixed interval)** | Proste | **Niespełnia FR-011** i sensu produktu SRS |

**Rekomendacja:** **ts-fsrs@5.4.1** — najlepszy stosunek zgodności ze stackiem, PRD i schematem F-01.

### 8. Dokumentacja w change folder

`context/changes/srs-review-session/ts-fsrs.md` (Context7, 2026-05-27) opisuje API zgodne z README npm 5.4.x — można traktować jako podstawę planu implementacji mapowania.

## Code References

- [`supabase/migrations/20260526211944_flashcard_schema.sql`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/supabase/migrations/20260526211944_flashcard_schema.sql#L18-L32) — `srs_state`, `due_at`, indeks sesji
- [`src/types.ts#L11-L19`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/src/types.ts#L11-L19) — typ `Flashcard` z polami SRS
- [`src/pages/api/flashcards/create.ts#L54-L61`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/src/pages/api/flashcards/create.ts#L54-L61) — insert bez `srs_state` (domyślne DB)
- [`src/lib/load-set-detail.ts#L49-L53`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/src/lib/load-set-detail.ts#L49-L53) — lista kart bez pól SRS
- [`src/middleware.ts#L4-L22`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/src/middleware.ts#L4-L22) — chronione trasy `/dashboard`, `/sets`
- [`.nvmrc`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/.nvmrc) — Node 22.14.0
- [`wrangler.jsonc#L6`](https://github.com/Agrestor666/10xcards/blob/e794b9d0ec27b7130019f418a5d55a629937d83d/wrangler.jsonc#L6) — `nodejs_compat`
- [`context/changes/srs-review-session/ts-fsrs.md`](context/changes/srs-review-session/ts-fsrs.md) — API i mapowanie DB (lokalny artefakt change)

## Architecture Insights

1. **Separacja warstw:** CRUD (S-03) vs scheduling (S-04) — update fiszki nie dotyka SRS; tylko dedykowany endpoint „grade card” wywołuje `scheduler.next()`.
2. **Query sesji:** Supabase `.eq('set_id', id).lte('due_at', nowIso).order('due_at')` — indeks `(set_id, due_at)` wspiera wydajność.
3. **Scheduler singleton:** jedna instancja `fsrs()` w module serwerowym (np. `src/lib/srs/scheduler.ts`) — bez stanu per-request.
4. **Preview opcjonalny:** `repeat()` może być w API (server zwraca 4 warianty `due`) lub pominięty w MVP — `next()` wystarczy do FR-011.
5. **Brak `review_logs` w MVP:** `result.log` nie musi być persystowany — roadmap wymaga tylko aktualizacji harmonogramu.

## Historical Context (from prior changes)

- `context/changes/data-schema-rls/plan.md` — F-01 celowo zostawił `srs_state` opaque i `due_at` indexed; S-04 „owns sync”.
- `context/changes/manual-flashcard-crud/plan.md` — update/delete nie zmieniają SRS; wspólny wzorzec API JSON.
- `context/foundation/roadmap.md` (S-04) — unknown: wybór biblioteki; **ten research zamyka unknown** na `ts-fsrs@5.4.1`.
- `context/foundation/prd.md` — FR-011: preferowana gotowa biblioteka algorytmu.

## Related Research

- `context/changes/srs-review-session/ts-fsrs.md` — dokumentacja API (Context7)
- `context/foundation/infrastructure.md` — Cloudflare Workers jako runtime docelowy

## Open Questions

1. **Preview w UI:** czy pokazywać użytkownikowi przewidywane `due` dla 4 ocen przed wyborem (`repeat` server-side) — decyzja UX w `/10x-plan`, nie blokada biblioteki.
2. **Kolejność kart w sesji:** `due_at ASC` vs losowa — produktowa decyzja planu.
3. **npm install na maszynie dev:** lokalny błąd SSL przy `registry.npmjs.org` (2026-05-27) — problem środowiska, nie ts-fsrs; CI/`npm ci` powinno działać po dodaniu zależności do `package.json`.

## Recommendation for `/10x-plan srs-review-session`

- **Biblioteka:** `ts-fsrs@^5.4.1` (pin w `package.json`).
- **Brak migracji DB** przed implementacją.
- **Nowe pliki (szkic):** `src/lib/srs/fsrs-mapper.ts`, `src/lib/srs/scheduler.ts`, `GET/POST` API review, strona `/sets/[id]/review` + island.
- **Następny krok:** `/10x-plan srs-review-session` z tym research jako wejściem.
