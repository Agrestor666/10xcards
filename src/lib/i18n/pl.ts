import { en } from "./en";

export const pl: Record<keyof typeof en, string> = {
  "locale.pl": "PL",
  "locale.en": "EN",

  "auth.error.invalid_credentials": "Nieprawidłowy email lub hasło.",
  "auth.error.email_taken": "Konto z tym adresem email już istnieje.",
  "auth.error.weak_password": "Hasło jest zbyt słabe. Użyj co najmniej 6 znaków.",
  "auth.error.rate_limit": "Zbyt wiele prób. Spróbuj ponownie później.",
  "auth.error.supabase_unconfigured": "Uwierzytelnianie nie jest skonfigurowane.",
  "auth.error.generic": "Coś poszło nie tak. Spróbuj ponownie.",
};
