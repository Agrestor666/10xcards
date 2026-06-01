import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { t, type MessageKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

export interface FlashcardDraft {
  question: string;
  answer: string;
}

export type FlashcardDraftValidationErrorKey = "both_required" | "max_chars" | "no_valid";

const DRAFT_ERROR_MESSAGE_KEYS: Record<FlashcardDraftValidationErrorKey, MessageKey> = {
  both_required: "flashcards.error.both_required",
  max_chars: "flashcards.error.max_chars",
  no_valid: "generator.error.no_valid_drafts",
};

export function flashcardDraftValidationMessage(
  locale: AppLocale,
  key: FlashcardDraftValidationErrorKey,
  params?: Record<string, string | number>,
): string {
  return t(locale, DRAFT_ERROR_MESSAGE_KEYS[key], params);
}

export type ValidateFlashcardDraftsResult =
  | { ok: true; cards: FlashcardDraft[] }
  | { ok: false; key: FlashcardDraftValidationErrorKey };

export type ValidateFlashcardDraftResult =
  | { ok: true; card: FlashcardDraft }
  | { ok: false; key: FlashcardDraftValidationErrorKey };

export function validateFlashcardDraft(raw: FlashcardDraft): ValidateFlashcardDraftResult {
  const question = raw.question.trim();
  const answer = raw.answer.trim();

  if (!question || !answer) {
    return { ok: false, key: "both_required" };
  }

  if (question.length > MAX_CARD_FIELD_CHARS || answer.length > MAX_CARD_FIELD_CHARS) {
    return { ok: false, key: "max_chars" };
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
      return { ok: false, key: "max_chars" };
    }

    cards.push({ question, answer });
  }

  if (cards.length === 0) {
    return { ok: false, key: "no_valid" };
  }

  return { ok: true, cards };
}
