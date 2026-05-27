import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { flashcardBulkCreateErrorMessage } from "@/lib/flashcard-errors";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { validateFlashcardDraft } from "@/lib/flashcard-draft-validation";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const createBodySchema = z.object({
  setId: z.uuid(),
  question: z.string().max(MAX_CARD_FIELD_CHARS),
  answer: z.string().max(MAX_CARD_FIELD_CHARS),
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
    return jsonResponse({ ok: false, message: "Please sign in to add a flashcard." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const validated = validateFlashcardDraft({
    question: parsed.data.question,
    answer: parsed.data.answer,
  });
  if (!validated.ok) {
    return jsonResponse({ ok: false, message: validated.error }, 400);
  }

  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      set_id: parsed.data.setId,
      question: validated.card.question,
      answer: validated.card.answer,
    })
    .select("id, set_id, question, answer, due_at, created_at, updated_at")
    .single();

  if (error) {
    return jsonResponse({ ok: false, message: flashcardBulkCreateErrorMessage(error) }, 403);
  }

  await touchFlashcardSetUpdatedAt(supabase, parsed.data.setId);

  return jsonResponse({ ok: true, card: data });
};
