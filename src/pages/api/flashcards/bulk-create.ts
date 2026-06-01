import type { APIRoute } from "astro";
import { z } from "zod";
import { MAX_CARDS_PER_REQUEST, MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { jsonResponse } from "@/lib/api-json";
import { flashcardDraftValidationMessage, validateFlashcardDrafts } from "@/lib/flashcard-draft-validation";
import { flashcardBulkCreateErrorMessage } from "@/lib/flashcard-errors";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";

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
  const locale = getLocaleFromContext(context);
  const supabase = context.locals.supabase;
  if (!supabase) {
    return jsonResponse({ ok: false, message: supabaseNotConfiguredMessage(locale) }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_save_flashcards") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = bulkCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const validated = validateFlashcardDrafts(parsed.data.cards);
  if (!validated.ok) {
    return jsonResponse(
      {
        ok: false,
        message: flashcardDraftValidationMessage(locale, validated.key, { max: MAX_CARD_FIELD_CHARS }),
      },
      400,
    );
  }

  const rows = validated.cards.map((card) => ({
    set_id: parsed.data.setId,
    question: card.question,
    answer: card.answer,
  }));

  const { error } = await supabase.from("flashcards").insert(rows);

  if (error) {
    return jsonResponse({ ok: false, message: flashcardBulkCreateErrorMessage(locale, error) }, 403);
  }

  await touchFlashcardSetUpdatedAt(supabase, parsed.data.setId);

  return jsonResponse({ ok: true, insertedCount: validated.cards.length });
};
