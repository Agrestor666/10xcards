import type { APIRoute } from "astro";
import { z } from "zod";
import { MAX_CARDS_PER_REQUEST } from "@/lib/ai-generation-limits";
import { jsonResponse } from "@/lib/api-json";
import { validateFlashcardDrafts } from "@/lib/flashcard-draft-validation";
import { flashcardBulkCreateErrorMessage } from "@/lib/flashcard-errors";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const bulkCreateBodySchema = z.object({
  setId: z.uuid(),
  cards: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .min(1)
    .max(MAX_CARDS_PER_REQUEST),
});

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ ok: false, message: SUPABASE_NOT_CONFIGURED_MESSAGE }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: "Please sign in to save flashcards." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = bulkCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const validated = validateFlashcardDrafts(parsed.data.cards);
  if (!validated.ok) {
    return jsonResponse({ ok: false, message: validated.error }, 400);
  }

  const rows = validated.cards.map((card) => ({
    set_id: parsed.data.setId,
    question: card.question,
    answer: card.answer,
  }));

  const { error } = await supabase.from("flashcards").insert(rows);

  if (error) {
    return jsonResponse({ ok: false, message: flashcardBulkCreateErrorMessage(error) }, 403);
  }

  await touchFlashcardSetUpdatedAt(supabase, parsed.data.setId);

  return jsonResponse({ ok: true, insertedCount: validated.cards.length });
};
