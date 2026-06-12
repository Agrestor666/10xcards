import { z } from "zod";

import { MAX_CARDS_PER_REQUEST } from "@/lib/ai-generation-limits";
import type { FlashcardDraft } from "@/lib/flashcard-draft-validation";

const cardDraftSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const cardsArraySchema = z.array(cardDraftSchema).min(1).max(MAX_CARDS_PER_REQUEST);

const wrappedCardsSchema = z.object({
  cards: cardsArraySchema,
});

export function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  return JSON.parse(candidate) as unknown;
}

export function parseCardsFromLlmPayload(payload: unknown): FlashcardDraft[] | null {
  const asArray = cardsArraySchema.safeParse(payload);
  if (asArray.success) {
    return asArray.data;
  }

  const asWrapped = wrappedCardsSchema.safeParse(payload);
  if (asWrapped.success) {
    return asWrapped.data.cards;
  }

  return null;
}
