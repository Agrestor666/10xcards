const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 80;

export type ValidateFlashcardSetNameResult = { ok: true; name: string } | { ok: false; error: string };

export function validateFlashcardSetName(raw: FormDataEntryValue | null): ValidateFlashcardSetNameResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Set name is required" };
  }

  const name = raw.trim();

  if (name.length < MIN_NAME_LENGTH) {
    return { ok: false, error: "Set name cannot be empty" };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Set name must be at most ${MAX_NAME_LENGTH} characters` };
  }

  return { ok: true, name };
}
