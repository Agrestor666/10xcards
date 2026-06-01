import { z } from "zod";
import { OPENROUTER_API_KEY } from "astro:env/server";
import {
  MAX_CARDS_PER_REQUEST,
  OPENROUTER_DEFAULT_BASE_URL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_REQUEST_TIMEOUT_MS,
} from "@/lib/ai-generation-limits";
import { type FlashcardDraft, validateFlashcardDrafts } from "@/lib/flashcard-draft-validation";

const cardDraftSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const cardsArraySchema = z.array(cardDraftSchema).min(1).max(MAX_CARDS_PER_REQUEST);

const wrappedCardsSchema = z.object({
  cards: cardsArraySchema,
});

const openRouterChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
});

export type GenerateFlashcardsResult = { ok: true; cards: FlashcardDraft[] } | { ok: false; errorKey: string };

const SYSTEM_PROMPT = `You are a flashcard generator. Given source study text, produce concise question-and-answer pairs that help the learner review the material.

Respond with ONLY valid JSON in this exact shape (no markdown, no commentary):
{"cards":[{"question":"...","answer":"..."}]}

Create multiple cards when the text supports it. Keep questions and answers clear and self-contained.`;

function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  return JSON.parse(candidate) as unknown;
}

function parseCardsFromLlmPayload(payload: unknown): FlashcardDraft[] | null {
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

export async function generateFlashcardsFromText(text: string): Promise<GenerateFlashcardsResult> {
  if (!OPENROUTER_API_KEY) {
    return { ok: false, errorKey: "generator.error.generate" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, OPENROUTER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENROUTER_DEFAULT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_DEFAULT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (import.meta.env.DEV) {
        const errText = await response.text().catch(() => "(unreadable)");
        // eslint-disable-next-line no-console -- dev-only OpenRouter diagnostics
        console.error(`OpenRouter HTTP ${response.status}:`, errText);
      }
      return { ok: false, errorKey: "generator.error.generate" };
    }

    const body: unknown = await response.json();
    const parsed = openRouterChatResponseSchema.safeParse(body);

    if (!parsed.success) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- dev-only OpenRouter diagnostics
        console.error("OpenRouter unexpected response shape:", body);
      }
      return { ok: false, errorKey: "generator.error.generate" };
    }

    let payload: unknown;
    try {
      payload = extractJsonPayload(parsed.data.choices[0].message.content);
    } catch {
      return { ok: false, errorKey: "generator.error.generate" };
    }

    const drafts = parseCardsFromLlmPayload(payload);
    if (!drafts) {
      return { ok: false, errorKey: "generator.error.generate" };
    }

    const validated = validateFlashcardDrafts(drafts);
    if (!validated.ok) {
      return { ok: false, errorKey: "generator.error.generate" };
    }

    return { ok: true, cards: validated.cards };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, errorKey: "generator.error.timeout" };
    }

    return { ok: false, errorKey: "generator.error.generate" };
  } finally {
    clearTimeout(timeoutId);
  }
}
