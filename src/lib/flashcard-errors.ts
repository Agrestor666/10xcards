import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

const POSTGRES_PERMISSION_DENIED = "42501";

/**
 * Maps Supabase/Postgres errors to user-safe strings for bulk flashcard insert.
 * Never forwards raw DB messages (policy names, SQL, internal codes).
 */
export function flashcardBulkCreateErrorMessage(locale: AppLocale, error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return t(locale, "flashcards.error.save_forbidden");
  }

  return t(locale, "flashcards.error.save");
}

export function flashcardCreateErrorMessage(locale: AppLocale, error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return t(locale, "flashcards.error.add_forbidden");
  }

  return t(locale, "flashcards.error.add");
}

export function flashcardUpdateErrorMessage(locale: AppLocale, error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return t(locale, "flashcards.error.update_forbidden");
  }

  return t(locale, "flashcards.error.save");
}

export function flashcardDeleteErrorMessage(locale: AppLocale, error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return t(locale, "flashcards.error.delete_forbidden");
  }

  return t(locale, "flashcards.error.delete");
}

export function flashcardNotFoundMessage(locale: AppLocale): string {
  return t(locale, "flashcards.error.not_found");
}
