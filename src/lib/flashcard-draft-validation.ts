import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";

export interface FlashcardDraft {
  question: string;
  answer: string;
}

export type ValidateFlashcardDraftsResult = { ok: true; cards: FlashcardDraft[] } | { ok: false; error: string };

export type ValidateFlashcardDraftResult = { ok: true; card: FlashcardDraft } | { ok: false; error: string };

export function validateFlashcardDraft(raw: FlashcardDraft): ValidateFlashcardDraftResult {
  const question = raw.question.trim();
  const answer = raw.answer.trim();

  if (!question || !answer) {
    return { ok: false, error: "Both question and answer are required." };
  }

  if (question.length > MAX_CARD_FIELD_CHARS || answer.length > MAX_CARD_FIELD_CHARS) {
    return {
      ok: false,
      error: `Each question and answer must be at most ${MAX_CARD_FIELD_CHARS} characters.`,
    };
  }

  return { ok: true, card: { question, answer } };
}

/**
 * Normalizes LLM or client card drafts: trim, drop empty, enforce per-field max length.
 */
export function validateFlashcardDrafts(raw: FlashcardDraft[]): ValidateFlashcardDraftsResult {
  const cards: FlashcardDraft[] = [];

  for (const item of raw) {
    const question = item.question.trim();
    const answer = item.answer.trim();

    if (!question || !answer) {
      continue;
    }

    if (question.length > MAX_CARD_FIELD_CHARS || answer.length > MAX_CARD_FIELD_CHARS) {
      return {
        ok: false,
        error: `Each question and answer must be at most ${MAX_CARD_FIELD_CHARS} characters.`,
      };
    }

    cards.push({ question, answer });
  }

  if (cards.length === 0) {
    return {
      ok: false,
      error: "No valid flashcards were found. Try editing the text or generating again.",
    };
  }

  return { ok: true, cards };
}
