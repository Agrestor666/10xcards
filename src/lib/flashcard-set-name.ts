import type { FlashcardSetErrorKey } from "@/lib/flashcard-set-errors";

export const FLASHCARD_SET_NAME_MAX_LENGTH = 80;

const MIN_NAME_LENGTH = 1;

export type FlashcardSetNameValidationKey = Extract<
  FlashcardSetErrorKey,
  "set_name_required" | "set_name_empty" | "set_name_max"
>;

export type ValidateFlashcardSetNameResult =
  | { ok: true; name: string }
  | { ok: false; key: FlashcardSetNameValidationKey };

export function validateFlashcardSetName(raw: FormDataEntryValue | null): ValidateFlashcardSetNameResult {
  if (typeof raw !== "string") {
    return { ok: false, key: "set_name_required" };
  }

  const name = raw.trim();

  if (name.length < MIN_NAME_LENGTH) {
    return { ok: false, key: "set_name_empty" };
  }

  if (name.length > FLASHCARD_SET_NAME_MAX_LENGTH) {
    return { ok: false, key: "set_name_max" };
  }

  return { ok: true, name };
}
