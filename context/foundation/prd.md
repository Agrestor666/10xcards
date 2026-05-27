---
project: "10xCards"
version: 1
status: draft
created: 2026-05-21
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 12
  hard_deadline: null
  after_hours_only: false
---

## Vision & Problem Statement

Ręczne tworzenie wysokiej jakości fiszek edukacyjnych jest skrajnie czasochłonne — student lub profesjonalista z surowym tekstem musi ręcznie formułować każdą parę pytanie-odpowiedź, zanim może zacząć naukę przez spaced repetition. Ten koszt wejścia blokuje adopcję najskuteczniejszej metody nauki: wielu rezygnuje z fiszek nie dlatego, że SRS nie działa, lecz dlatego że samo przygotowanie materiału jest barierą.

Modele językowe obniżają koszt ekstrakcji wiedzy do zera — to, co zajmowało godziny manualnej pracy, można teraz wygenerować w sekundy. Żadne z popularnych narzędzi (Anki, Quizlet) nie zintegrowało tej możliwości z pełnym przepływem: generowanie + zarządzanie + powtórki w jednym miejscu.

## User & Persona

**Persona:** Indywidualny learner — student, profesjonalista, osoba samokształcąca się.

**Kontekst:** Ma źródło wiedzy (notatki, artykuł, fragment podręcznika) i chce jak najszybciej przejść do sesji powtórkowej.

**Moment:** Wkleja tekst do narzędzia i oczekuje gotowych fiszek — bez ręcznej pracy redakcyjnej.

**Problem:** Obecne narzędzia wymagają albo manualnego tworzenia fiszek, albo uczenia się złożonego interfejsu, albo opuszczenia środowiska nauki i przejścia do zewnętrznego narzędzia.

## Success Criteria

### Primary

- ≥75% fiszek wygenerowanych automatycznie jest akceptowanych przez użytkownika bez poprawek lub z minimalną edycją — dowód na jakość generowania.

### Secondary

- ≥75% wszystkich fiszek w systemie powstaje przy użyciu modułu generowania (dowód, że użytkownicy wolą automatyzację od ręcznego wpisywania).
- ≥30% zarejestrowanych użytkowników wraca w ciągu pierwszych 14 dni, aby przejść sesję powtórkową (walidacja przydatności silnika SRS).

### Guardrails

- Tekst wklejony przez użytkownika nie jest przechowywany w żadnym dostępnym storage po zakończeniu żądania generowania.
- Zestawy fiszek użytkownika nie mogą ulec utracie w wyniku błędu systemu.
- Generowanie fiszek musi zakończyć się w < 10 sekund dla typowego tekstu (≤ ~1500 słów), tak by oczekiwanie nie przerywało przepływu nauki.

## User Stories

### US-01: User generates flashcards from pasted text and starts a review session

- **Given** a logged-in user with at least one named flashcard set
- **When** they paste raw text into the generator and confirm generation
- **Then** they see a list of generated Q+A pairs, can accept / edit / delete individual cards, save the accepted cards to their set, and start a review session immediately

#### Acceptance Criteria

- At least one Q+A pair is generated for any text of ≥ 100 words
- Each generated card shows question and answer separately before saving
- User can edit question or answer inline before saving
- User can delete any individual generated card before saving
- Saved cards appear immediately in the selected set
- Review session opens with the cards from that set

### US-02: User manually adds a flashcard to a set

- **Given** a logged-in user viewing a named flashcard set
- **When** they use the manual creation form to enter a question and an answer
- **Then** the card is saved to the set and available in the next review session

#### Acceptance Criteria

- Form requires both question and answer fields (non-empty)
- Card appears in the set list immediately after saving

## Functional Requirements

### Authentication

- FR-001: User can register an account with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "registration delays first value — a new user could try generation before creating an account." Resolution: kept as must-have; cloud sync requires identity. However, this surfaces a UX opportunity: onboarding flow could defer registration to the moment of first save rather than blocking the generation experience. Captured as Open Question 1.
- FR-002: User can log in to and log out of their account. Priority: must-have

### Flashcard Sets

- FR-003: User can create a named flashcard set. Priority: must-have
  > Socrates: No counter-argument; named sets are necessary to organize content by subject/topic. Stands as written.
- FR-007: User can browse all their saved flashcard sets. Priority: must-have

### AI Generation

- FR-004: User can paste raw text and receive generated flashcard pairs (Q+A). Priority: must-have
  > Socrates: No counter-argument; this is the core product capability. Stands as written.
- FR-005: User can review generated cards and accept, edit, or delete individual cards before saving to a set. Priority: must-have
  > Socrates: Counter-argument considered: "inline editing is a complex UI surface for MVP — accept/reject only would be simpler, with CRUD editing available post-save." Resolution: kept with inline editing. The review step without editing is too limiting — a card with a wrong answer that can only be accepted or rejected forces the user into a worse workflow than just saving and editing separately. Inline editing is load-bearing for trust in the generated output.

### Manual Creation & CRUD

- FR-006: User can add a single flashcard manually via a form. Priority: must-have
  > Socrates: No counter-argument; manual creation is the necessary fallback for cases where generated output is insufficient or the user wants to add targeted cards. Stands as written.
- FR-008: User can edit the content of a saved flashcard. Priority: must-have
- FR-009: User can delete a saved flashcard from a set. Priority: must-have

### Spaced Repetition

- FR-010: User can start a spaced-repetition review session for a selected set. Priority: must-have
- FR-011: System schedules the next review date for each card based on a spaced-repetition algorithm after each review response. Priority: must-have
  > Socrates: Counter-argument considered: "SRS scheduling only matters after day 2+ — a simple one-pass review is enough to validate MVP." Resolution: kept as must-have. Without scheduling, the product doesn't fulfill its stated purpose (spaced repetition). The technical risk is manageable by using a pre-existing algorithm implementation rather than a custom one.

## Non-Functional Requirements

- A learner sees acknowledgement of any input within 200 ms, and continuous visible progress during any generation operation that takes longer than 2 seconds.
- Flashcard generation for a typical text (≤ ~1 500 words) completes in under 10 seconds as perceived by the user.
- Source text submitted for generation leaves no trace in any operator-accessible storage after the request that consumed it completes.
- Saved flashcard sets are durable — no card is lost due to a system error.
- The product is usable on the latest two major versions of Chrome, Firefox, Safari, and Edge (desktop).
- The layout remains usable on modern mobile browsers without horizontal scrolling or illegible text.

## Business Logic

The application extracts key knowledge from raw text and produces structured question-answer pairs, then schedules when each pair should be reviewed next based on how confidently the user answered it in previous sessions.

**Inputs (user-facing):** Raw text pasted by the user (any language, any subject); user's self-assessed confidence response during each review session (e.g., "easy / hard / forgot").

**Output:** A set of question-answer pairs derived from the text; a review schedule that prioritizes cards the user found difficult and spaces out cards the user answered confidently.

**How the user encounters it:** After pasting text, the user sees generated cards within seconds. After each review session response, the product updates when that card will appear next — the user only sees "next session" or a due date, not the underlying calculation.

## Access Control

Registration and login via email and password. Flat model — every registered user has the same capabilities: creates their own named flashcard sets, manages cards within them, and runs review sessions. No administrator role in the MVP scope. Flashcard sets are private — visible only to the account owner.

An unauthenticated user who reaches a gated route is redirected to the login page. There is no guest or read-only mode.

## Non-Goals

- **No file import (PDF, DOCX, TXT, PPTX)** — generation input is paste-only in MVP; parsing external documents adds a significant surface area and is not required to validate core value.
- **No social / sharing features** — sets are private; no public sharing, ratings, collaborative editing, or community decks in MVP.
- **No external platform integrations** — no Quizlet import/export, no LMS plugins, no Notion sync, no third-party API in MVP.
- **No native mobile apps** — web-only in MVP; no App Store / Google Play releases. The web app is mobile-browser-responsive.

## Open Questions

1. **Onboarding registration gate** — Should a first-time visitor be able to try generation before creating an account, with registration deferred to the moment of first save? Owner: user. Block: no (UX decision; does not prevent implementation from starting).
