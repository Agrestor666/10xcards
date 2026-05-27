# Specyfikacja MVP - Generator Fiszek AI (10xCards)

## Główny problem

Manualne tworzenie wysokiej jakości fiszek edukacyjnych jest skrajnie czasochłonne, co zniechęca użytkowników do regularnego korzystania z najbardziej efektywnej metody nauki, jaką jest system powtórek rozłożonych w czasie (spaced repetition). Brak szybkiego narzędzia do konwersji surowej wiedzy na gotowe pytania i odpowiedzi blokuje potencjał produktywności osób uczących się.

## Najmniejszy zestaw funkcjonalności (MVP)

- **Generowanie fiszek przez AI:** Moduł oparty na LLM, który na podstawie wklejonego przez użytkownika surowego tekstu (metoda kopiuj-wklej) automatycznie ekstrahuje kluczowe informacje i tworzy gotowe pary pytań i odpowiedzi.
- **Manualny kreator:** Prosty formularz pozwalający użytkownikowi na tradycyjne, ręczne dopisywanie pojedynczych fiszek do swoich zestawów.
- **Zarządzanie bazą (CRUD):** Przejrzysty panel użytkownika umożliwiający przeglądanie, edycję treści oraz usuwanie zbędnych lub błędnie wygenerowanych fiszek.
- **Podstawowy system kont:** Prosta autentykacja (rejestracja i logowanie) w celu bezpiecznego przechowywania i synchronizacji zestawów fiszek danego użytkownika w chmurze.
- **Gotowy silnik powtórek:** Integracja bazy danych z prostym, gotowym i powszechnie dostępnym algorytmem powtórek (np. bazującym na podstawowych przedziałach czasowych lub uproszczonym Leitner system).
- **Dostępność Webowa:** Lekka aplikacja uruchamiana w przeglądarce, zoptymalizowana pod kątem szybkiej pracy na komputerach i urządzeniach mobilnych.

## Co NIE wchodzi w zakres MVP

1.  **Własny, zaawansowany algorytm:** Brak dedykowanych, skomplikowanych silników matematycznych (jak autorskie implementacje algorytmów Anki SM-2 czy SuperMemo) – MVP bazuje wyłącznie na gotowych, uproszczonych rozwiązaniach bibliotecznych.
2.  **Import z plików zewnętrznych:** Całkowity brak obsługi parsowania dokumentów takich jak PDF, DOCX, TXT czy prezentacji PPTX. W fazie MVP jedynym źródłem danych dla AI jest bezpośrednio wklejony tekst.
3.  **Funkcje społecznościowe (Sharing):** Brak możliwości publicznego udostępniania, oceniania, komentowania lub wspólnego edytowania zestawów fiszek między różnymi użytkownikami.
4.  **Integracje z zewnętrznymi platformami:** Brak wtyczek oraz API do systemów LMS, Quizlet, Notion czy tradycyjnych e-dzienników.
5.  **Natywne aplikacje mobilne:** Brak dedykowanych aplikacji na systemy iOS oraz Android w sklepach App Store / Google Play – projekt startuje wyłącznie jako platforma webowa.

## Kryteria sukcesu

- **Efektywność algorytmu AI:** Przynajmniej 75% fiszek wygenerowanych automatycznie przez sztuczną inteligencję jest akceptowane przez użytkownika bez wprowadzania poprawek lub z minimalną edycją.
- **Adopcja technologii AI:** Przynajmniej 75% wszystkich fiszek istniejących w systemie powstaje przy użyciu modułu generowania AI (dowód na to, że użytkownicy wolą automatyzację od ręcznego wpisywania).
- **Retencja użytkowników:** Minimum 30% zarejestrowanych użytkowników powraca do aplikacji w ciągu pierwszych 14 dni, aby przejść sesję powtórkową (walidacja przydatności silnika spaced repetition).
