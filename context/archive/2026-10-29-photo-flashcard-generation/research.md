---
date: 2026-10-29T19:39:22+01:00
researcher: Auto (Cursor)
git_commit: c82c20a1dfebdd7624e6b6b2f86a097f8ff67205
branch: publish/local-master
repository: Agrestor666/10xcards
topic: "Jak wyciągnąć tekst ze zdjęcia z pisanym tekstem dla photo-flashcard-generation"
tags: [research, codebase, openrouter, vision, ocr, photo-flashcard-generation, s-14]
status: complete
last_updated: 2026-10-29
last_updated_by: Auto (Cursor)
---

# Research: Jak wyciągnąć tekst ze zdjęcia z pisanym tekstem

**Date**: 2026-10-29T19:39:22+01:00
**Researcher**: Auto (Cursor)
**Git Commit**: `c82c20a1dfebdd7624e6b6b2f86a097f8ff67205`
**Branch**: `publish/local-master`
**Repository**: [Agrestor666/10xcards](https://github.com/Agrestor666/10xcards)

## Research Question

Jak wyciągnąć tekst ze zdjęcia z pisanym tekstem (pismo ręczne albo druk na zdjęciu) w slice `photo-flashcard-generation`, na obecnym stosie generowania fiszek.

## Summary

Osobnego OCR w projekcie nie ma. Odczyt robi ten sam model, który już generuje fiszki: `google/gemini-2.5-flash-lite` przez `POST https://openrouter.ai/api/v1/chat/completions`. OpenRouter podaje dla tego modelu wejście `text+image+file+audio+video` i `input_modalities` zawierające `image`.

Dzisiejszy kod wysyła treść wiadomości jako zwykły string, więc obrazu nie przepuści. Żeby odczytać pismo, wiadomość użytkownika musi być tablicą: najpierw polecenie transkrypcji, potem obraz jako data URL base64 (`image/jpeg`, `image/png`, `image/webp` albo `image/gif`). Publiczny URL odpada — zdjęcie nie może zostać nigdzie zapisane ani wystawione.

Wynik transkrypcji to zwykły tekst. Wchodzi w istniejące `generateFlashcardsFromText` (limit 20 000 znaków, brak zapisu źródła, ta sama bramka przeglądu kart). Pismo ręczne i druk idą tą samą ścieżką; jakość odręcznych polskich notatek nie jest zmierzona.

Klasyczny OCR (Tesseract) i binding `IMAGES` w Wranglerze nie są drogą odczytu. Binding jest nieużywany i służy do przekształcania obrazów, nie do czytania tekstu.

## Detailed Findings

### Generowanie dziś przyjmuje tylko tekst

`POST /api/ai/generate` czyta JSON i woła handler ([`src/pages/api/ai/generate.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/pages/api/ai/generate.ts#L10-L28)). Handler rozróżnia `mode: "text"` i `mode: "topic"` ([`src/lib/ai-generate-handler.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/lib/ai-generate-handler.ts#L37-L68)). Tekst źródłowy jest obcinany do `MAX_SOURCE_TEXT_CHARS = 20_000` i dopiero wtedy idzie do modelu ([`ai-generate-handler.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/lib/ai-generate-handler.ts#L124-L139), [`ai-generation-limits.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/lib/ai-generation-limits.ts#L1-L22)).

Wywołanie tekstowe skleja string, nie części multimodalne:

```114:122:src/lib/openrouter-generate.ts
export async function generateFlashcardsFromText(text: string): Promise<GenerateFlashcardsResult> {
  return requestOpenRouterCards({
    model: OPENROUTER_DEFAULT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  });
}
```

Model: `google/gemini-2.5-flash-lite`. Timeout upstream: 30 s. Klucz: `OPENROUTER_API_KEY` (server-only). W `package.json` nie ma SDK OpenRouter, biblioteki OCR ani Tesseract — OpenRouter to zwykły `fetch`.

UI: `FlashcardGenerator` ma tylko `"text" | "topic"` ([`FlashcardGenerator.tsx`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/components/generator/FlashcardGenerator.tsx#L50)). Po generacji karty siedzą w stanie szkicu; `FlashcardRow` w trybie draft pozwala edytować albo usunąć kartę, a zapis idzie przez `POST /api/flashcards/bulk-create`. Zdjęcie może skończyć w tym samym szkicu, gdy z obrazu powstanie string.

### Jak OpenRouter czyta zdjęcie

Dokumentacja [Image Inputs](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding) (stan na 2026-10-29):

- Ten sam endpoint `/api/v1/chat/completions`.
- Obraz idzie tylko do modelu multimodalnego, w `messages[].content` jako tablica.
- Najpierw część `text`, potem `image_url`. Kolejność jest zalecana, bo parser treści tak ją czyta.
- URL albo base64. Dla pliku lokalnego i prywatnego: data URL. Typy: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- Przykład w dokumentacji używa `google/gemini-3-flash-preview` tylko jako wzór wywołania. Nie jest to model tego projektu.

Kształt body, zgodny z obecnym `fetch` (nie z SDK):

```json
{
  "model": "google/gemini-2.5-flash-lite",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Transcribe every visible word exactly, including handwriting. Keep the original language and line breaks. Do not summarize and do not invent text."
        },
        {
          "type": "image_url",
          "image_url": { "url": "data:image/jpeg;base64,..." }
        }
      ]
    }
  ]
}
```

Odpowiedź zostaje tekstem w `choices[0].message.content` — ten sam kształt, który [`openRouterChatResponseSchema`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/lib/openrouter-generate.ts#L12-L22) już parsuje. Transkrypcja nie powinna żądać `response_format: json_object`; JSON jest potrzebny dopiero przy zamianie tekstu na fiszki.

### Czy obecny model przyjmuje obraz

Tak. `GET https://openrouter.ai/api/v1/models/google/gemini-2.5-flash-lite/endpoints` (2026-10-29) zwraca:

- `architecture.modality`: `text+image+file+audio+video->text`
- `architecture.input_modalities`: `text`, `image`, `file`, `audio`, `video`
- `architecture.output_modalities`: `text`

Endpointy Google AI Studio mają w cenniku pole `image`. Osobny OCR nie jest potrzebny do pisma drukowanego ani odręcznego: oba są tekstem widocznym na obrazie, a model dostaje polecenie transkrypcji. Dokumentacja OpenRouter nie podaje osobnej jakości dla pisma ręcznego.

### Czego nie używać

| Ścieżka | Werdykt |
| --- | --- |
| Tesseract / biblioteka OCR w Workerze | Brak w zależnościach. Słaba na piśmie ręcznym. Natywny binarny OCR nie pasuje do Workera. |
| `images.binding: "IMAGES"` w [`wrangler.jsonc`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/wrangler.jsonc#L20-L22) | Nieużywany w `src/`. To przekształcanie obrazów Cloudflare, nie odczyt tekstu. |
| Publiczny URL obrazu w `image_url` | Dokumentacja poleca URL dla treści publicznych. Zdjęcie fiszek jest prywatne i nie może zostać zapisane. |
| Jedno wywołanie „obraz → fiszki” | Pomija istniejący generator tekstu i ukrywa błąd odczytu aż do kart. Transkrypcja, potem `generateFlashcardsFromText`, zostawia limit 20 000 znaków i bramkę FR-005. |

### Prywatność, rozmiar, auth

NFR w [`context/foundation/prd.md`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/context/foundation/prd.md#L117): tekst źródłowy nie zostawia śladu w storage dostępnym operatorowi po zakończeniu żądania, które go zużyło. Handler generowania nie woła `supabase.from` ([`ai-generate-handler.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/lib/ai-generate-handler.ts#L14-L15)). Migracja nie ma kolumny na tekst źródłowy ani na obraz. S-14 w roadmapie mówi to samo o zdjęciu: służy tylko do odczytu i nie jest zapisywane.

Praktyczne limity przy base64:

- Aplikacja czyta całe body przez `request.json()` ([`generate.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/pages/api/ai/generate.ts#L15)). Nie ma własnego limitu bajtów, tylko limit znaków tekstu po odczycie.
- [Limity Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/): body żądania do 100 MB na planie Free i Pro; pamięć Workera 128 MB. Buforowanie dużego zdjęcia w JSON plus base64 (około 4/3 rozmiaru pliku) zjada pamięć, zanim model cokolwiek odczyta.
- Zdjęcie z aparatu trzeba zmniejszyć w przeglądarce do JPEG, zanim powstanie data URL. Limit bajtów obrazu należy ustalić w planie; repo go nie ma.
- Timeout 30 s obejmuje jedno wywołanie OpenRouter. Odczyt i generacja fiszek to dwa wywołania, każde ze swoim timeoutem.
- Generowanie wymaga zalogowanego użytkownika: `getUser()` → 401 ([`ai-generate-handler.ts`](https://github.com/Agrestor666/10xcards/blob/c82c20a1dfebdd7624e6b6b2f86a097f8ff67205/src/lib/ai-generate-handler.ts#L87-L94)). Nowe stringi UI idą parami do `src/lib/i18n/en.ts` i `pl.ts`.

Aparat i wgranie pliku są tym samym po stronie serwera: bajty obrazu. W `src/` nie ma `capture`, `FormData` z plikiem ani Storage.

## Code References

- `src/lib/openrouter-generate.ts:114-122` — generacja z tekstu; `content` jest stringiem
- `src/lib/openrouter-generate.ts:54-61` — `fetch` na `/chat/completions`
- `src/lib/ai-generation-limits.ts:2` — `MAX_SOURCE_TEXT_CHARS = 20_000`
- `src/lib/ai-generation-limits.ts:22` — `OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash-lite"`
- `src/lib/ai-generate-handler.ts:124-139` — trim, limit, brak zapisu źródła
- `src/pages/api/ai/generate.ts:15` — całe body jako JSON
- `src/components/generator/FlashcardGenerator.tsx:50` — tryby `text` i `topic`
- `wrangler.jsonc:20-22` — nieużywany binding `IMAGES`
- `context/foundation/prd.md:117` — NFR: tekst źródłowy bez śladu po żądaniu
- `context/foundation/prd.md:140` — non-goal: import PDF, DOCX, TXT, PPTX
- `context/foundation/roadmap.md` — S-14 (lokalna, niezcommitowana zmiana roadmapy)

## Architecture Insights

Odczyt pisma jest osobnym krokiem przed generacją kart, nie nowym dostawcą. Obraz zostaje w pamięci żądania jako data URL, model zwraca transkrypcję, transkrypcja wchodzi w istniejącą ścieżkę tekstową. Dzięki temu FR-005 (akceptuj / edytuj / usuń przed zapisem) i zakaz trzymania źródła zostają bez zmian.

Pismo ręczne nie wymaga drugiej integracji. Różnica wobec druku jest w jakości odczytu, nie w kontrakcie API. Jedno wywołanie „zrób fiszki z tego zdjęcia” skleiłoby te dwa ryzyka: zły odczyt i złe karty.

Import PDF/DOCX/TXT/PPTX zostaje poza tym slice. OpenRouter umie też przyjąć PDF jako `file`, ale PRD i S-14 trzymają te formaty w Parked.

## Historical Context (from prior changes)

- `context/archive/2026-05-27-ai-generation-save/plan-brief.md` — OpenRouter przez serwerowy `fetch`, mały szybki model, bez SDK, żeby działało na Cloudflare Workers.
- `context/archive/2026-05-27-ai-generation-save/plan.md` — wklejony tekst tylko w pamięci żądania; nie zapisywać go w DB, KV ani logach. Wejście generacji w MVP to wklejka, nie plik.
- `context/archive/2026-06-12-ai-generation-contract-privacy/plan-brief.md` — po zapisie zostają pytanie i odpowiedź; handler generowania nie echo-uje źródła i nie woła `supabase.from`.
- `context/changes/topic-flashcard-generation/plan.md` — drugi tryb wejścia (temat) dokłada się do tego samego endpointu i tej samej bramki szkicu. Zdjęcie może być trzecim wejściem w ten sam sposób, z transkrypcją przed `generateFlashcardsFromText`.

## Related Research

- `context/archive/2026-05-27-srs-review-session/research.md` — jedyny wcześniejszy `research.md`; nie dotyczy obrazów.
- `context/changes/topic-flashcard-generation/plan.md` — wzorzec drugiego trybu generacji na OpenRouter.

## Open Questions

- Jakość transkrypcji polskiego pisma ręcznego (notatka, tablica) na `google/gemini-2.5-flash-lite` nie jest zmierzona. Druk i pismo idą tym samym wywołaniem; zła jakość pisma ręcznego jest ryzykiem produktu, nie powodem na osobny OCR.
- Czy użytkownik widzi transkrypcję i może ją poprawić przed generacją kart, czy od razu widzi fiszki. Bramka FR-005 i tak jest na kartach. Poprawianie tekstu źródłowego łapie błąd odczytu wcześniej.
- Górny rozmiar JPEG po zmniejszeniu w przeglądarce. Repo limituje znaki tekstu, nie bajty obrazu.
