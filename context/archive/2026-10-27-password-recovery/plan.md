# Odzyskanie zapomnianego hasła — plan implementacji

## Overview

Użytkownik, który nie pamięta hasła, prosi o link z ekranu logowania, ustawia nowe hasło z maila i wraca na logowanie z komunikatem, że może się zalogować starym adresem i nowym hasłem. Zestawy i fiszki zostają.

## Current State Analysis

Logowanie i rejestracja to strony Astro w paper theme plus formularze React wysyłające POST na `/api/auth/signin` i `/api/auth/signup`. Błędy wracają jako `?error=<AuthErrorKey>` i są tłumaczone w `resolveAuthErrorMessage`. Middleware wpuszcza gościa na `/auth/*`, a zalogowanego użytkownika z `/auth/signin` i `/auth/signup` odsyła na `/dashboard`.

W `src/` nie ma `resetPasswordForEmail`, `verifyOtp` ani strony nowego hasła. `confirm-email.astro` to statyczny komunikat „sprawdź skrzynkę”, bez obsługi linku. `supabase/config.toml` ma `site_url = "http://127.0.0.1:3000"` i pustą listę redirectów pod aplikację Astro (`localhost:4321`). Szablony maili są zakomentowane. Lokalne maile łapie Inbucket na porcie 54324.

`prd.md` nie ma osobnego FR na reset. Slice S-11 w roadmapie jest źródłem zakresu. Reguła hasła przy rejestracji to minimum 6 znaków i zgodne powtórzenie (`SignUpForm.tsx`).

### Key Discoveries:

- Brak linku „nie pamiętam hasła”: `src/pages/auth/signin.astro`.
- Klucze błędów auth są domkniętą unią: `src/lib/auth-errors.ts`. Nowy klucz trzeba dodać do unii, zbioru i mapy tłumaczeń.
- `MessageKey` pochodzi z `en.ts`; `pl.ts` musi mieć każdy nowy klucz.
- Playwright: spec gościa musi trafić do projektu `guest` w `playwright.config.ts`. Domyślny projekt `chromium` niesie sesję zalogowanego użytkownika i z `/auth/forgot-password` dostałby redirect na dashboard.
- `resetPasswordForEmail` nie zwraca błędu, gdy konta nie ma — mail po prostu nie wychodzi. To jest właściwy komunikat „sprawdź skrzynkę” bez zdradzania, czy adres istnieje.
- Domyślny link PKCE działa tylko w przeglądarce, która poprosiła o reset (ciasteczko code verifier). Link z `token_hash` i `verifyOtp({ type: 'recovery' })` działa też na innym urządzeniu.
- `secure_password_change = false` w lokalnym `config.toml`. Włączenie tej opcji zablokuje `updateUser({ password })` w sesji recovery.

## Desired End State

Z logowania da się przejść do formularza e-mail. Po wysłaniu poprawnego adresu użytkownik widzi stronę „sprawdź skrzynkę” — tę samą, gdy konto istnieje i gdy nie istnieje. Limit częstotliwości zostaje na formularzu jako błąd.

Link z maila otwiera formularz nowego hasła. Po zapisie użytkownik jest wylogowany i ląduje na `/auth/signin` z komunikatem sukcesu. Starym hasłem się nie zaloguje, nowym się zaloguje. Nieważny albo zużyty link pokazuje na stronie resetu komunikat i odnośnik do ponownej prośby, bez wejścia na dashboard.

Zalogowany użytkownik, który otworzy prośbę o reset albo link z maila mając już zwykłą sesję, trafia na dashboard. Sesja powstała dopiero co z `verifyOtp` zostaje na formularzu nowego hasła.

UI jest w paper theme i w PL oraz EN.

Weryfikacja automatyczna: `npm test`, `npm run lint`, `npm run test:e2e` dla nowych speców. Weryfikacja ręczna: pełna ścieżka przez Inbucket.

## What We're NOT Doing

- Zmiana hasła z ustawień zalogowanego konta.
- Logowanie społecznościowe i magiczny link zamiast hasła.
- Odzyskiwanie konta bez dostępu do skrzynki.
- Osobne FR w `prd.md`.
- Własny serwer SMTP. Lokalnie Inbucket, na produkcji istniejąca poczta projektu Supabase.
- Odczyt treści maila w teście automatycznym.

## Implementation Approach

Dwie fazy pionowe. Pierwsza domyka prośbę o mail i jednakowy komunikat sukcesu. Druga domyka wejście z linku, zapis hasła i wylogowanie.

Prośba idzie istniejącym wzorcem: Astro + React `POST` + `context.locals.supabase`. Decyzja, dokąd przekierować, siedzi w czystej funkcji w `src/lib/`, tak jak `toAuthErrorKey`, i tę funkcję pokrywa Vitest. Trasa zostaje cienka.

Link w mailu buduje szablon recovery z `{{ .TokenHash }}`, nie domyślny `{{ .ConfirmationURL }}`. Serwer na `/auth/recover` woła `verifyOtp` tylko dla `type=recovery`, ustawia krótkie ciasteczko znacznika i przekierowuje na formularz. Po udanym `updateUser({ password })` trasa woła `signOut`, kasuje znacznik i przekierowuje na logowanie. Inaczej middleware potraktuje sesję recovery jak zwykłe logowanie i zje komunikat sukcesu, odsyłając na dashboard.

## Critical Implementation Details

### Sesja recovery a middleware

`/auth/forgot-password` i `/auth/check-email` dokładamy do listy ścieżek, z których zalogowany użytkownik idzie na `/dashboard` (`src/middleware.ts`, dziś `/`, `/auth/signin`, `/auth/signup`).

`/auth/recover` i `/auth/reset-password` nie wchodzą na tę listę. Na `/auth/recover` zalogowana sesja, która istniała **przed** tą prośbą, kończy się redirectem na `/dashboard` **bez** `verifyOtp` (token zostaje do użycia po wylogowaniu). Brak sesji: `verifyOtp`, przy sukcesie ciasteczko `pw-recovery` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=3600`) i redirect na `/auth/reset-password`. Przy błędzie: `/auth/reset-password?error=link_invalid` bez sesji.

Na `/auth/reset-password`: użytkownik bez sesji albo `error=link_invalid` widzi stan „link nieważny” i link do `/auth/forgot-password`. Użytkownik z sesją i bez ciasteczka `pw-recovery` idzie na `/dashboard`. Użytkownik z sesją i z ciasteczkiem widzi formularz.

Parametr `next` z URL ignorujemy. Cel po `verifyOtp` jest zawsze `/auth/reset-password`.

### Szablon i allow lista

`resetPasswordForEmail` dostaje `redirectTo` równy originowi bieżącej prośby plus `/auth/recover` (`context.url.origin`). Ten origin musi być na liście redirectów Supabase. Lokalne `site_url` (`127.0.0.1:3000`) nie jest adresem Astro (`localhost:4321`). Do `additional_redirect_urls` dochodzą `http://localhost:4321` i `http://127.0.0.1:4321`. `site_url` zostaje.

Szablon recovery (plik w repo, podpięty w `config.toml`):

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset</a>
```

Na produkcji ten sam HTML i origin Workera trzeba wpisać w panelu Supabase (Redirect URLs + szablon Reset password). Deploy Workera sam szablonu nie aktualizuje.

### Hasło i wylogowanie

Minimalna długość 6 i zgodne powtórzenie, jak przy rejestracji. Po sukcesie kolejność na jednej odpowiedzi: `updateUser({ password })`, `signOut`, skasowanie `pw-recovery`, redirect na `/auth/signin?notice=password_updated`. Komunikat sukcesu idzie osobnym parametrem `notice`, nie przez `error`.

Sfałszowane ciasteczko `pw-recovery` przy już zalogowanej sesji pozwala zmienić hasło właściciela tej sesji. To nie otwiera cudzego konta. Osobnego ekranu w ustawieniach i tak nie ma.

## Phase 1: Prośba o link

### Overview

Z logowania da się poprosić o mail resetujący. Odpowiedź nie zdradza, czy adres ma konto. Zalogowany użytkownik nie widzi tego formularza.

### Changes Required:

#### 1. Tłumaczenia

**File**: `src/lib/i18n/en.ts`, `src/lib/i18n/pl.ts`

**Intent**: Copy PL i EN dla linku na logowaniu, formularza prośby, strony „sprawdź skrzynkę” oraz — od razu, żeby drugiej fazy nie rozjechać typem `MessageKey` — formularza nowego hasła, stanu nieważnego linku i komunikatu sukcesu na logowaniu.

**Contract**: Każdy nowy klucz istnieje w obu plikach. `pl.ts` zostaje `Record<keyof typeof en, string>`.

#### 2. Link na logowaniu i formularz prośby

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/forgot-password.astro`, `src/components/auth/ForgotPasswordForm.tsx`

**Intent**: Na karcie logowania, nad stopką rejestracji, link do `/auth/forgot-password`. Nowa strona powtarza shell logowania (`Layout`, `PaperShell`, karta `max-w-sm`) i formularz z samym e-mailem.

**Contract**: Formularz `POST` na `/api/auth/forgot-password`. Walidacja e-maila po stronie klienta tym samym wzorcem co `SignInForm`. Błąd z `?error=` przez `resolveAuthErrorMessage` i `ServerError`. Stopka wraca na `/auth/signin`.

#### 3. API prośby

**File**: `src/pages/api/auth/forgot-password.ts`, `src/lib/password-recovery.ts`, `src/lib/password-recovery.test.ts`

**Intent**: Serwer woła `resetPasswordForEmail` i zawsze prowadzi do tej samej strony sukcesu, gdy Supabase nie zgłosi błędu. Błąd transportu, konfiguracji albo limitu zostaje na formularzu.

**Contract**: `redirectTo` = `${origin}/auth/recover`. Czysta funkcja decyduje o celu:

- brak błędu → `/auth/check-email`
- limit częstotliwości (istniejące rozpoznanie `rate_limit` w `toAuthErrorKey`) → `/auth/forgot-password?error=rate_limit`
- pusty albo źle zbudowany e-mail → `/auth/forgot-password?error=email_invalid` (nowy `AuthErrorKey` plus tłumaczenie)
- każdy inny błąd → `/auth/forgot-password?error=` z `toAuthErrorKey`
- osobnego celu „użytkownik nie istnieje” nie ma

Vitest pokrywa te cztery gałęzie bez klienta Supabase i bez Astro.

#### 4. Strona „sprawdź skrzynkę”

**File**: `src/pages/auth/check-email.astro`

**Intent**: Statyczny komunikat w tym samym układzie co `confirm-email.astro`: mail mógł wyjść, użytkownik wraca na logowanie. Treść nie mówi „wysłaliśmy”, mówi „jeśli konto istnieje, link jest w skrzynce”.

**Contract**: Brak odczytu tokenu. Jeden link na `/auth/signin`.

#### 5. Middleware

**File**: `src/middleware.ts`

**Intent**: Zalogowany użytkownik nie wypełnia formularza resetu ani nie czyta strony „sprawdź skrzynkę”.

**Contract**: Do warunku redirectu na `/dashboard` dochodzą dokładnie `/auth/forgot-password` i `/auth/check-email`. Żadna inna ścieżka auth się nie zmienia.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi, a `src/lib/password-recovery.test.ts` obejmuje cztery cele redirectu prośby o reset.
- `npm run lint` przechodzi.

#### Manual Verification:

- Na logowaniu widać link, a wysłanie poprawnego e-maila (istniejącego i nieistniejącego) kończy się tą samą stroną „sprawdź skrzynkę”.
- Pusty albo źle zbudowany e-mail oraz limit częstotliwości zostają na formularzu z błędem.
- Wejście na `/auth/forgot-password` z aktywną sesją kończy się na `/dashboard`.

**Implementation Note**: Po zielonych testach automatycznych zatrzymaj się na ręczne potwierdzenie tej fazy, zanim ruszysz fazę 2.

---

## Phase 2: Nowe hasło z maila

### Overview

Link z maila otwiera formularz nowego hasła. Po zapisie sesja znika, a logowanie pokazuje sukces. Nieważny link zostaje na stronie resetu.

### Changes Required:

#### 1. Szablon maila i redirecty lokalne

**File**: `supabase/templates/recovery.html`, `supabase/config.toml`

**Intent**: Mail resetu prowadzi na naszą aplikację z `token_hash`, także gdy skrzynka otworzy się na innym urządzeniu. Lokalny Supabase akceptuje origin Astro.

**Contract**: Sekcja `[auth.email.template.recovery]` wskazuje `content_path` na szablon z linkiem `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`. `additional_redirect_urls` zawiera `http://localhost:4321` i `http://127.0.0.1:4321`. `site_url` i `secure_password_change` bez zmian. Po edycji lokalny stack trzeba zrestartować, żeby szablon wszedł.

#### 2. Odbiór linku

**File**: `src/pages/auth/recover.astro`

**Intent**: Jedno miejsce wymienia `token_hash` na sesję recovery i puszcza użytkownika na formularz. Innych typów OTP ta trasa nie przyjmuje, żeby nie stała się drugim potwierdzeniem rejestracji.

**Contract**: Frontmatter, bez UI. Brak `token_hash` albo `type` inny niż `recovery` → `/auth/reset-password?error=link_invalid`. Jest `context.locals.user` → `/dashboard` i brak wywołania `verifyOtp`. `verifyOtp({ type: 'recovery', token_hash })` z błędem → ten sam `link_invalid`. Sukces → ciasteczko `pw-recovery` i redirect na `/auth/reset-password`. Parametr `next` ignorowany.

#### 3. Formularz nowego hasła

**File**: `src/pages/auth/reset-password.astro`, `src/components/auth/ResetPasswordForm.tsx`

**Intent**: Użytkownik z ważną sesją recovery ustawia hasło dwa razy. Nieważny link widzi wyjaśnienie i drogę do ponownej prośby, bez formularza.

**Contract**: Reguły jak `SignUpForm`: wymagane, minimum 6, zgodne powtórzenie, `PasswordToggle`. `POST` na `/api/auth/reset-password`. `error=link_invalid` oraz brak sesji renderują stan nieważnego linku z odnośnikiem na `/auth/forgot-password`. Sesja bez ciasteczka `pw-recovery` → redirect `/dashboard`.

#### 4. Zapis hasła i komunikat na logowaniu

**File**: `src/pages/api/auth/reset-password.ts`, `src/lib/password-recovery.ts`, `src/lib/password-recovery.test.ts`, `src/pages/auth/signin.astro`, `src/lib/auth-errors.ts`

**Intent**: Zapis nowego hasła kończy sesję recovery i odkłada komunikat na ekranie logowania. Słabe hasło zostaje przy formularzu.

**Contract**: Brak sesji albo brak `pw-recovery` → `/auth/reset-password?error=link_invalid`. Hasło poniżej 6 znaków albo niezgodne powtórzenie → `/auth/reset-password?error=weak_password` (istniejący klucz; niezgodność powtórzenia łapie też klient). Błąd `updateUser` mapuje `toAuthErrorKey`. Sukces: `signOut`, skasowanie `pw-recovery`, redirect `/auth/signin?notice=password_updated`. `signin.astro` czyta `notice` osobno od `error` i pokazuje tekst nad formularzem. Vitest dokłada gałęzie: brak sesji, słabe hasło, sukces (cel redirectu i fakt wylogowania jako decyzja funkcji, nie żywy Supabase).

#### 5. Smoke Playwright

**File**: `e2e/password-recovery.spec.ts`, `e2e/password-recovery-signed-in.spec.ts`, `playwright.config.ts`

**Intent**: Automatycznie widać, że gość przechodzi prośbę do strony „sprawdź skrzynkę”, a nieważny link nie wpuszcza na dashboard. Zalogowany użytkownik nie zostaje na formularzu prośby.

**Contract**: `password-recovery.spec.ts` wchodzi do `testMatch` projektu `guest` i do `testIgnore` projektu `chromium`. Asercje gościa: link na logowaniu, pusta wysyłka zostaje na formularzu, nieznany e-mail kończy na check-email, `/auth/reset-password?error=link_invalid` pokazuje link ponownej prośby i nie pokazuje przycisku „New set” / „Nowy zestaw”. `password-recovery-signed-in.spec.ts` zostaje w projekcie `chromium` (sesja z `auth.setup.ts`): `/auth/forgot-password` ląduje na `/dashboard`. Spec nie otwiera Inbucket i nie klika linku z maila.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi, łącznie z gałęziami zapisu hasła w `src/lib/password-recovery.test.ts`.
- `npm run lint` przechodzi.
- `npx playwright test e2e/password-recovery.spec.ts e2e/password-recovery-signed-in.spec.ts` przechodzi.

#### Manual Verification:

- W Inbucket (`http://127.0.0.1:54324`) link z maila otwiera formularz, nowe hasło zapisuje się, ekran logowania pokazuje sukces, stare hasło jest odrzucane, nowe loguje na dashboard.
- Link z przekręconym `token_hash` pokazuje stan nieważny i odnośnik do ponownej prośby, bez dashboardu.
- Nowe ekrany mają polski i angielski copy zgodny z locale.
- W panelu Supabase produkcji: origin Workera jest na Redirect URLs, a szablon Reset password jest kopią `supabase/templates/recovery.html`.

**Implementation Note**: Po zielonych testach automatycznych zatrzymaj się na przejście ręczne przez Inbucket. Krok panelu produkcji zostaje otwarty, dopóki szablon i allow lista nie są wklejone — bez tego produkcyjny mail nie trafi na `/auth/recover`.

---

## Testing Strategy

### Unit Tests:

- Cel redirectu prośby: brak błędu, limit, zły e-mail, inny błąd. Brak gałęzi „nie ma konta”.
- Cel zapisu hasła: brak sesji albo znacznika, hasło za krótkie, sukces oznacza wylogowanie i `notice=password_updated`.

### Integration Tests:

- Playwright gościa przeciw działającemu dev serverowi i lokalnemu Supabase: nieznany e-mail kończy na check-email (prawdziwe `resetPasswordForEmail`, bez asercji treści maila).
- Playwright zalogowanej sesji: redirect z formularza prośby.

### Manual Testing Steps:

1. Poproś o reset istniejącego konta lokalnego, otwórz mail w Inbucket, ustaw hasło, zaloguj się nowym.
2. Poproś o reset adresu, którego nie ma, i porównaj stronę „sprawdź skrzynkę” z krokiem 1.
3. Otwórz zużyty link drugi raz.
4. Będąc zalogowanym, wejdź na `/auth/forgot-password` i na świeży link z maila.
5. Przełącz locale PL/EN na landingu przed wejściem w auth i sprawdź nowe napisy.

## Performance Considerations

Jedno wywołanie Auth na prośbę i jedno na zapis. Brak list, cache i paginacji. Limit częstotliwości zostaje przy Supabase (`max_frequency` w `config.toml`).

## Migration Notes

Brak migracji schematu i zmian RLS. Lokalna zmiana to `config.toml` plus plik szablonu. Działający lokalny stack trzeba zrestartować po zapisie szablonu. Produkcja wymaga ręcznej kopii szablonu i originu w panelu Supabase; repozytorium tego nie wdraża.

## References

- Slice: `context/foundation/roadmap.md` (S-11)
- Wzorzec stron: `src/pages/auth/signin.astro`, `src/pages/auth/confirm-email.astro`, `src/pages/api/auth/signin.ts`
- Błędy: `src/lib/auth-errors.ts`
- Reguła hasła: `src/components/auth/SignUpForm.tsx` (`MIN_PASSWORD_LENGTH = 6`)
- Middleware: `src/middleware.ts`
- Playwright guest: `playwright.config.ts`, `e2e/guest-protected-route-redirect.spec.ts`
- Supabase: password reset (`resetPasswordForEmail` nie ujawnia braku konta), szablony (`TokenHash`, `RedirectTo`), `verifyOtp` dla `type=recovery`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prośba o link

#### Automated

- [x] 1.1 `npm test` przechodzi, a `src/lib/password-recovery.test.ts` obejmuje cztery cele redirectu prośby o reset — 6b78b4e
- [x] 1.2 `npm run lint` przechodzi — 6b78b4e

#### Manual

- [x] 1.3 Na logowaniu widać link, a wysłanie poprawnego e-maila (istniejącego i nieistniejącego) kończy się tą samą stroną „sprawdź skrzynkę” — 6b78b4e
- [x] 1.4 Pusty albo źle zbudowany e-mail oraz limit częstotliwości zostają na formularzu z błędem — 6b78b4e
- [x] 1.5 Wejście na `/auth/forgot-password` z aktywną sesją kończy się na `/dashboard` — 6b78b4e

### Phase 2: Nowe hasło z maila

#### Automated

- [x] 2.1 `npm test` przechodzi, łącznie z gałęziami zapisu hasła w `src/lib/password-recovery.test.ts` — 20f6df8
- [x] 2.2 `npm run lint` przechodzi — 20f6df8
- [x] 2.3 `npx playwright test e2e/password-recovery.spec.ts e2e/password-recovery-signed-in.spec.ts` przechodzi — 20f6df8

#### Manual

- [x] 2.4 W Inbucket link z maila otwiera formularz, nowe hasło zapisuje się, logowanie pokazuje sukces, stare hasło jest odrzucane, nowe loguje na dashboard — 20f6df8
- [x] 2.5 Link z przekręconym `token_hash` pokazuje stan nieważny i odnośnik do ponownej prośby, bez dashboardu — 20f6df8
- [x] 2.6 Nowe ekrany mają polski i angielski copy zgodny z locale — 20f6df8
- [ ] 2.7 W panelu Supabase produkcji origin Workera jest na Redirect URLs, a szablon Reset password jest kopią `supabase/templates/recovery.html`
