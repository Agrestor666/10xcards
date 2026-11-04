# Odzyskanie zapomnianego hasła — Plan Brief

> Full plan: `context/changes/password-recovery/plan.md`

## What & Why

Użytkownik z ekranu logowania prosi o link na e-mail, ustawia nowe hasło i wraca na logowanie z komunikatem sukcesu. Konto e-mail + hasło nie ma dziś drogi powrotu, gdy hasło zginie. Zestawy i fiszki zostają na tym samym koncie.

## Starting Point

Działają rejestracja, logowanie i statyczna strona „potwierdź e-mail”. Nie ma `resetPasswordForEmail`, wymiany linku na sesję ani formularza nowego hasła. Middleware odsyła zalogowanych z logowania i rejestracji na dashboard. Lokalny `site_url` Supabase wskazuje `127.0.0.1:3000`, a aplikacja stoi na `localhost:4321`.

## Desired End State

Prośba o reset kończy się tą samą stroną „sprawdź skrzynkę” dla adresu z kontem i bez konta. Link z maila otwiera formularz także na innym urządzeniu. Po zapisie użytkownik jest wylogowany i widzi na logowaniu, że może wejść nowym hasłem. Nieważny link zostaje na stronie resetu z możliwością wysłania maila jeszcze raz. Zalogowany użytkownik, który sam wejdzie w prośbę o reset, ląduje na dashboardzie.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Po zapisie hasła | Wylogowanie i komunikat na logowaniu | Tak wybrałeś: sukces widać na `/auth/signin`, a nie ciche wejście na dashboard. |
| Nieważny link | Zostaje na stronie resetu, z linkiem „wyślij ponownie” | Użytkownik jest wciąż w ścieżce resetu i może od razu poprosić o nowy mail. |
| Już zalogowany | Prośba o reset i link przy istniejącej sesji → dashboard | Ta ścieżka jest dla osoby, która nie może się zalogować; sesja utworzona dopiero przez link zostaje na formularzu. |
| Testy | Vitest kontraktu redirectów + smoke Playwright; mail ręcznie | Prawdziwy mail zależy od Inbucketa i panelu Supabase, a kontrakt „nie zdradzaj, czy konto istnieje” da się sprawdzić bez skrzynki. |
| Link w mailu | `token_hash` + `verifyOtp` type `recovery` | Domyślny link PKCE działa tylko w przeglądarce, która poprosiła o reset. |

## Scope

**In scope:** link na logowaniu, formularz e-mail, strona „sprawdź skrzynkę”, odbiór linku, formularz nowego hasła (min. 6 znaków i powtórzenie), wylogowanie, komunikat sukcesu, copy PL/EN, paper theme, szablon maila w repo, allow lista originu lokalnego, smoke testy.

**Out of scope:** zmiana hasła w ustawieniach, logowanie społecznościowe, magiczny link, odzyskiwanie bez skrzynki, osobne FR w PRD, automatyczny odczyt maila, własny SMTP.

## Architecture / Approach

`POST /api/auth/forgot-password` woła `resetPasswordForEmail` z `redirectTo` na `/auth/recover`. Szablon składa URL z `RedirectTo`, `TokenHash` i `type=recovery`. `/auth/recover` woła `verifyOtp`, stawia ciasteczko `pw-recovery` i puszcza na formularz. `POST /api/auth/reset-password` zapisuje hasło, woła `signOut` i wraca na logowanie z `?notice=password_updated`. Decyzje redirectów są czystymi funkcjami w `src/lib/password-recovery.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Prośba o link | Link, formularz, jednakowa strona sukcesu, testy redirectu | Przypadkowe rozróżnienie „konto jest / konta nie ma”. |
| 2. Nowe hasło z maila | Odbiór linku, zapis, wylogowanie, smoke, szablon | Middleware wyrzuci sesję recovery na dashboard, zanim użytkownik wpisze hasło. Szablon produkcji jest poza repo. |

**Prerequisites:** lokalny Supabase z Inbucketem; działające logowanie e-mail + hasło.
**Estimated effort:** dwie fazy, po jednej sesji implementacji.

## Open Risks & Assumptions

- Panel produkcji Supabase trzeba uzupełnić ręcznie (Redirect URLs + szablon). Do tego czasu mail produkcyjny nie wejdzie na `/auth/recover`.
- `secure_password_change` zostaje wyłączone. Włączenie blokuje zmianę hasła w sesji z linku.
- Ciasteczko `pw-recovery` tylko rozdziela „właśnie przeszedłem z maila” od „jestem zalogowany i wpisałem URL”. Nie chroni przed zmianą własnego hasła przez właściciela sesji.

## Success Criteria (Summary)

- Nieznany i znany e-mail kończą na tej samej stronie „sprawdź skrzynkę”.
- Link z Inbucketa pozwala ustawić hasło, stare hasło przestaje działać, nowe loguje na dashboard, a ekran logowania wcześniej pokazał sukces.
- Nieważny link i wejście zalogowanego użytkownika w formularz prośby nie kończą się formularzem resetu ani wyciekiem istnienia konta.
