import { t, type MessageKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

/** Shown when server env lacks Supabase URL/key. */
export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Check SUPABASE_URL and SUPABASE_KEY in your environment.";

export type FlashcardSetErrorKey =
  | "set_create_failed"
  | "set_create_forbidden"
  | "set_name_required"
  | "set_name_empty"
  | "set_name_max"
  | "set_not_found"
  | "set_invalid"
  | "supabase_unconfigured";

const FLASHCARD_SET_ERROR_KEYS = new Set<string>([
  "set_create_failed",
  "set_create_forbidden",
  "set_name_required",
  "set_name_empty",
  "set_name_max",
  "set_not_found",
  "set_invalid",
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
  return t(locale, FLASHCARD_SET_MESSAGE_KEYS[key], params);
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

export function toFlashcardSetValidationErrorKey(message: string): FlashcardSetErrorKey {
  if (message.includes("required")) {
    return "set_name_required";
  }
  if (message.includes("empty")) {
    return "set_name_empty";
  }
  if (message.includes("at most")) {
    return "set_name_max";
  }

  return "set_create_failed";
}

/** Legacy English mapper — Phase 4 will migrate update/delete routes to error keys. */
export function flashcardSetCreateErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not create set. You do not have permission to perform this action.";
  }

  return "Could not create set. Please try again.";
}

export function flashcardSetUpdateErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not rename set. You do not have permission to edit it.";
  }

  return "Could not rename set. Please try again.";
}

export function flashcardSetDeleteErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not delete set. You do not have permission to delete it.";
  }

  return "Could not delete set. Please try again.";
}
