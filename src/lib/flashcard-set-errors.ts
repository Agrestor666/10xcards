import { t, type MessageKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import { FLASHCARD_SET_NAME_MAX_LENGTH } from "@/lib/flashcard-set-name";

export function supabaseNotConfiguredMessage(locale: AppLocale): string {
  return t(locale, "config.supabase.message");
}

export type FlashcardSetErrorKey =
  | "set_create_failed"
  | "set_create_forbidden"
  | "set_name_required"
  | "set_name_empty"
  | "set_name_max"
  | "set_not_found"
  | "set_invalid"
  | "set_update_failed"
  | "set_update_forbidden"
  | "set_delete_failed"
  | "set_delete_forbidden"
  | "supabase_unconfigured";

const FLASHCARD_SET_ERROR_KEYS = new Set<string>([
  "set_create_failed",
  "set_create_forbidden",
  "set_name_required",
  "set_name_empty",
  "set_name_max",
  "set_not_found",
  "set_invalid",
  "set_update_failed",
  "set_update_forbidden",
  "set_delete_failed",
  "set_delete_forbidden",
  "supabase_unconfigured",
]);

const FLASHCARD_SET_MESSAGE_KEYS: Record<FlashcardSetErrorKey, MessageKey> = {
  set_create_failed: "sets.error.create_failed",
  set_create_forbidden: "sets.error.create_forbidden",
  set_name_required: "sets.grid.validation.name_empty",
  set_name_empty: "sets.grid.validation.name_empty",
  set_name_max: "sets.grid.validation.name_max",
  set_not_found: "sets.error.not_found",
  set_invalid: "sets.error.invalid",
  set_update_failed: "sets.error.update_failed",
  set_update_forbidden: "sets.error.update_forbidden",
  set_delete_failed: "sets.error.delete_failed",
  set_delete_forbidden: "sets.error.delete_forbidden",
  supabase_unconfigured: "config.supabase.message",
};

const POSTGRES_PERMISSION_DENIED = "42501";

export function isFlashcardSetErrorKey(value: string): value is FlashcardSetErrorKey {
  return FLASHCARD_SET_ERROR_KEYS.has(value);
}

export function flashcardSetErrorMessage(
  locale: AppLocale,
  key: FlashcardSetErrorKey,
  params?: Record<string, string | number>,
): string {
  const resolvedParams =
    key === "set_name_max" && params?.max === undefined ? { max: FLASHCARD_SET_NAME_MAX_LENGTH, ...params } : params;

  return t(locale, FLASHCARD_SET_MESSAGE_KEYS[key], resolvedParams);
}

const LEGACY_ERROR_MESSAGES: Record<string, FlashcardSetErrorKey> = {
  "Could not create set. Please try again.": "set_create_failed",
  "Could not create set. You do not have permission to perform this action.": "set_create_forbidden",
  "Set name is required": "set_name_required",
  "Set name cannot be empty": "set_name_empty",
};

export function resolveFlashcardSetErrorMessage(
  locale: AppLocale,
  errorParam: string | null,
  params?: Record<string, string | number>,
): string | null {
  if (!errorParam) {
    return null;
  }

  const decoded = decodeURIComponent(errorParam);

  if (isFlashcardSetErrorKey(decoded)) {
    return flashcardSetErrorMessage(locale, decoded, params);
  }

  if (decoded in LEGACY_ERROR_MESSAGES) {
    return flashcardSetErrorMessage(locale, LEGACY_ERROR_MESSAGES[decoded], params);
  }

  if (decoded.startsWith("Set name must be at most")) {
    return flashcardSetErrorMessage(locale, "set_name_max", params);
  }

  return null;
}

export function toFlashcardSetCreateErrorKey(error: { code?: string }): FlashcardSetErrorKey {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "set_create_forbidden";
  }

  return "set_create_failed";
}

export function toFlashcardSetUpdateErrorKey(error: { code?: string }): FlashcardSetErrorKey {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "set_update_forbidden";
  }

  return "set_update_failed";
}

export function toFlashcardSetDeleteErrorKey(error: { code?: string }): FlashcardSetErrorKey {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "set_delete_forbidden";
  }

  return "set_delete_failed";
}

export function flashcardSetCreateErrorMessage(locale: AppLocale, error: { code?: string }): string {
  return flashcardSetErrorMessage(locale, toFlashcardSetCreateErrorKey(error));
}

export function flashcardSetUpdateErrorMessage(locale: AppLocale, error: { code?: string }): string {
  return flashcardSetErrorMessage(locale, toFlashcardSetUpdateErrorKey(error));
}

export function flashcardSetDeleteErrorMessage(locale: AppLocale, error: { code?: string }): string {
  return flashcardSetErrorMessage(locale, toFlashcardSetDeleteErrorKey(error));
}
