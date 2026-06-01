# Propozycja redesignu dashboardu — 10xCards

> Data: 2026-05-28  
> Status: propozycja do przeglądu  
> Kontekst: dashboard wygląda jak template startera (10x Astro Starter), nie jak produkt do nauki z fiszkami.

---

## Diagnoza — dlaczego wygląda jak template

### 1. Wizualnie to nadal „10x Astro Starter”

- Tło `bg-cosmic`, szkło (`border-white/10 bg-white/10 backdrop-blur`), gradient blue→purple na nagłówkach — ten sam język co landing w `Welcome.astro`.
- Layout domyślnie ma tytuł `"10x Astro Starter"`, nie „10xCards”.

### 2. Układ to CRUD-admin, nie produkt do nauki

Dashboard to pionowy stos identycznych sekcji w `src/pages/dashboard.astro`:

1. Header: „Your sets” + email
2. Sekcja: „Create a new set”
3. `FlashcardGenerator`
4. Sekcja: „All sets” → lista

To wygląda jak panel ustawień, nie jak **„co mam dziś powtórzyć?”**.

### 3. Brak metafory fiszek / SRS

- Lista w `SetDashboardList` to wiersze z linkiem + Edit/Delete — generyczny pattern SaaS.
- Brakuje: kart do powtórki dziś, postępu, ostatniej aktywności, szybkiego „Start review”.
- North star produktu (AI + zapis + SRS) nie dominuje ekranu.

### 4. Powtarzalne klasy zamiast design systemu aplikacji

Te same `rounded-2xl border border-white/10 bg-white/10 p-6` są w dashboardzie, generatorze i stronie zestawu — brak własnych komponentów typu `AppShell`, `SetCard`, `StudyHero`.

---

## Kierunki redesignu (zgodne z produktem)

### Kierunek A: „Study hub” (najbardziej sensowny dla 10xCards)

Dashboard odpowiada na 3 pytania użytkownika:

| Pytanie | UI |
|--------|-----|
| Co powtórzyć teraz? | Hero: „12 kart do powtórki” + CTA per zestaw |
| Jak szybko dodać materiał? | AI generator jako główna akcja (nie środkowa sekcja) |
| Co mam w bibliotece? | Kafelki zestawów, nie lista administracyjna |

Dane już są w schemacie (`due_at`, `flashcards(count)`) — wystarczy rozszerzyć query SSR o `due_count`.

### Kierunek B: Metafory fiszek

- Zestawy jako **stosy kart** (mini-stack z liczbą kart, kolor akcentu per zestaw).
- Hover z lekkim „lift” / cień — odczuwalna fizyczność.
- Akcje: **Study** (primary), **Add cards**, menu ⋯ (rename/delete).

### Kierunek C: Nowa tożsamość wizualna (odcięcie od startera)

Zamiast kosmicznego fioletu:

- **Ciepły, papierowy** motyw (off-white, serif na nagłówkach) — jak notes.
- Albo **minimal dark** bez gradientów (jeden akcent, np. zielony „due today”).
- Własna typografia (np. `Instrument Serif` + `DM Sans`) zamiast domyślnego systemowego stacku.

**Największy efekt:** kierunek A + fragment B. Sama zmiana kolorów bez zmiany struktury nadal będzie „ładnym templatem”.

---

## Propozycja nowego layoutu (szkic)

```
┌─────────────────────────────────────────┐
│ 10xCards          [Settings] [Sign out] │
├─────────────────────────────────────────┤
│  Dziś do powtórki: 12 kart              │
│  [Kontynuuj: Biologia]  [Zobacz wszystkie]│
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Biologia │ │Historia │ │ + Nowy  │   │
│  │28 kart  │ │5 due    │ │  zestaw │   │
│  │3 due    │ │         │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│  ✨ Wygeneruj fiszki z tekstu (collapsible)│
└─────────────────────────────────────────┘
```

Create / rename / delete zostają, ale **schowane** (modal, inline na kafelku, menu kontekstowe) — nie dominują ekranu.

---

## Trzy poziomy wysiłku

| Poziom | Zmiany | Efekt |
|--------|--------|-------|
| **S** | Rebrand copy + tytuły, hero z liczbą zestawów/kart, kafelki zamiast listy, jeden wspólny `DashboardShell` | Duży skok bez backendu |
| **M** | Query `due_count` per set, sekcja „Due today”, primary CTA „Start review”, generator jako drawer/modal | Produkt zaczyna „żyć” |
| **L** | Nowy design system (kolory, fonty, komponenty), landing też rebrand, opcjonalnie PL copy | Pełna tożsamość marki |

---

## Czego unikać

- Kolejnej warstwy glassmorphismu w innym odcieniu fioletu — to nie odróżni produktu.
- Dashboardu jako długiego formularza (create + AI + lista) — użytkownik nie wie, od czego zacząć.
- Dużego redesignu bez slice’a w roadmapie — łatwo rozjechać się z S-06 (settings) i innymi ekranami.

---

## Jak to ugryźć w workflow 10x

Sensowny slice: **`dashboard-redesign`** albo **`study-hub-ui`**

| Pole | Wartość |
|------|---------|
| Typ | UI + SSR (bez migracji DB) |
| Zależności | S-01, S-04, S-05 (już zaimplementowane) |
| Outcome | Użytkownik widzi co powtórzyć i zarządza zestawami bez poczucia admin panelu |

Kroki:

1. `/10x-shape` — doprecyzować kierunek (study hub vs papierowy notes vs minimal dark)
2. `/10x-plan` — pliki do zmiany, query SSR, komponenty
3. `/10x-implement` — wdrożenie

---

## Pliki do dotknięcia (orientacyjnie)

| Plik | Rola |
|------|------|
| `src/pages/dashboard.astro` | Layout, SSR query, sekcje |
| `src/components/sets/SetDashboardList.tsx` | Lista → kafelki / karty |
| `src/components/generator/FlashcardGenerator.tsx` | Hero vs collapsible |
| `src/components/Topbar.astro` | Nawigacja, branding |
| `src/layouts/Layout.astro` | Domyślny tytuł strony |
| `src/styles/global.css` | Nowy motyw (jeśli kierunek C) |
| `src/components/Welcome.astro` | Rebrand landingu (poziom L) |

---

## Pytanie do decyzji jutro

Co bliżej wizji?

- **A)** Nauka / SRS na pierwszym planie (study hub)
- **B)** AI generator jako hero (north star PRD)
- **C)** Nowa estetyka wizualna (odcięcie od startera) — z A lub B

Można też połączyć: np. **A + B** (due today hero + generator jako druga sekcja) z lekkim rebrandem copy (poziom S).
