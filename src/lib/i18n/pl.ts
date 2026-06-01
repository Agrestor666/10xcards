import { en } from "./en";

export const pl: Record<keyof typeof en, string> = {
  "locale.pl": "PL",
  "locale.en": "EN",

  "common.warning": "Uwaga:",

  "pages.home.title": "10xCards — fiszki AI ze spaced repetition",
  "pages.signin.title": "Zaloguj się",
  "pages.signup.title": "Zarejestruj się",

  "landing.hero.headline": "Fiszki z Twojego tekstu. Powtórki na autopilocie.",
  "landing.hero.subhead": "10xCards łączy generowanie AI ze spaced repetition — uczysz się, zamiast formatować fiszki.",
  "landing.cta.get_started": "Zacznij",
  "landing.cta.sign_in": "Zaloguj się",
  "landing.feature.ai.title": "AI z Twojego tekstu",
  "landing.feature.ai.description":
    "Wklej rozdział, artykuł lub notatki. Otrzymasz fiszki do edycji, zanim trafią do zestawu.",
  "landing.feature.reviews.title": "Powtórki według harmonogramu",
  "landing.feature.reviews.description":
    "Zacznij od tego, co masz dziś do powtórki. Po każdej odpowiedzi aplikacja planuje kolejną — bez arkusza kalkulacyjnego.",
  "landing.feature.hub.title": "Jedno miejsce do nauki",
  "landing.feature.hub.description":
    "Generuj, organizuj zestawy i ucz się z pulpitu. Twoja biblioteka jest prywatna na Twoim koncie.",

  "topbar.sign_in": "Zaloguj się",
  "topbar.sign_up": "Zarejestruj się",

  "auth.signin.heading": "Zaloguj się",
  "auth.signin.footer": "Nie masz konta?",
  "auth.signin.footer_link": "Zarejestruj się",
  "auth.signup.heading": "Zarejestruj się",
  "auth.signup.footer": "Masz już konto?",
  "auth.signup.footer_link": "Zaloguj się",

  "auth.confirm.auto.heading": "Rejestracja zakończona",
  "auth.confirm.auto.description": "Twoje konto zostało utworzone. Możesz się teraz zalogować.",
  "auth.confirm.auto.link": "Przejdź do logowania",
  "auth.confirm.email.heading": "Sprawdź email",
  "auth.confirm.email.description":
    "Wysłaliśmy link potwierdzający na Twój adres email. Kliknij go, aby aktywować konto.",
  "auth.confirm.email.link": "Wróć do logowania",

  "auth.field.email": "Email",
  "auth.field.password": "Hasło",
  "auth.field.confirm_password": "Potwierdź hasło",
  "auth.placeholder.email": "ty@example.com",
  "auth.placeholder.password": "Twoje hasło",
  "auth.placeholder.password_min": "Min. 6 znaków",
  "auth.placeholder.confirm_password": "Wpisz hasło ponownie",

  "auth.validation.email_required": "Email jest wymagany",
  "auth.validation.email_invalid": "Podaj prawidłowy adres email",
  "auth.validation.password_required": "Hasło jest wymagane",
  "auth.validation.password_min": "Hasło musi mieć co najmniej {min} znaków",
  "auth.validation.confirm_required": "Potwierdź hasło",
  "auth.validation.password_mismatch": "Hasła nie są identyczne",
  "auth.validation.password_chars_needed_one": "Potrzebny jeszcze {count} znak",
  "auth.validation.password_chars_needed_other": "Potrzebne jeszcze {count} znaki",

  "auth.button.sign_in": "Zaloguj się",
  "auth.button.sign_in_pending": "Logowanie...",
  "auth.button.create_account": "Utwórz konto",
  "auth.button.create_account_pending": "Tworzenie konta...",

  "auth.password.show": "Pokaż hasło",
  "auth.password.hide": "Ukryj hasło",

  "auth.error.invalid_credentials": "Nieprawidłowy email lub hasło.",
  "auth.error.email_taken": "Konto z tym adresem email już istnieje.",
  "auth.error.weak_password": "Hasło jest zbyt słabe. Użyj co najmniej 6 znaków.",
  "auth.error.rate_limit": "Zbyt wiele prób. Spróbuj ponownie później.",
  "auth.error.supabase_unconfigured": "Uwierzytelnianie nie jest skonfigurowane.",
  "auth.error.generic": "Coś poszło nie tak. Spróbuj ponownie.",

  "config.supabase.message": "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
  "config.docs_label": "Zobacz instrukcję konfiguracji",
};
