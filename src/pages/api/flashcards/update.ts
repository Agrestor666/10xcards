import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { flashcardUpdateErrorMessage } from "@/lib/flashcard-errors";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { validateFlashcardDraft } from "@/lib/flashcard-draft-validation";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
export const prerender = false;

const updateBodySchema = z.object({
  id: z.uuid(),
  question: z.string().max(MAX_CARD_FIELD_CHARS),
  answer: z.string().max(MAX_CARD_FIELD_CHARS),
});

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return jsonResponse({ ok: false, message: SUPABASE_NOT_CONFIGURED_MESSAGE }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: "Please sign in to update a flashcard." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = updateBodySchema.safeParse(body);
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
    .update({
      question: validated.card.question,
      answer: validated.card.answer,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .select("id, set_id, question, answer, due_at, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, message: flashcardUpdateErrorMessage(error) }, 403);
  }

  if (!data) {
    return jsonResponse({ ok: false, message: "Flashcard not found." }, 404);
  }

  await touchFlashcardSetUpdatedAt(supabase, z.uuid().parse(data.set_id));

  return jsonResponse({ ok: true, card: data });
};
