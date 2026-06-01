import type { APIRoute } from "astro";
import { z } from "zod";
import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { jsonResponse } from "@/lib/api-json";
import { flashcardDraftValidationMessage, validateFlashcardDraft } from "@/lib/flashcard-draft-validation";
import { flashcardNotFoundMessage, flashcardUpdateErrorMessage } from "@/lib/flashcard-errors";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";

export const prerender = false;

const updateBodySchema = z.object({
  setId: z.uuid(),
  cardId: z.uuid(),
  question: z.string().max(MAX_CARD_FIELD_CHARS),
  answer: z.string().max(MAX_CARD_FIELD_CHARS),
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
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_update_flashcard") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = updateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const validated = validateFlashcardDraft({
    question: parsed.data.question,
    answer: parsed.data.answer,
  });
  if (!validated.ok) {
    return jsonResponse(
      {
        ok: false,
        message: flashcardDraftValidationMessage(locale, validated.key, { max: MAX_CARD_FIELD_CHARS }),
      },
      400,
    );
  }

  const { data, error } = await supabase
    .from("flashcards")
    .update({
      question: validated.card.question,
      answer: validated.card.answer,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.cardId)
    .eq("set_id", parsed.data.setId)
    .select("id, set_id, question, answer, due_at, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, message: flashcardUpdateErrorMessage(locale, error) }, 403);
  }

  if (!data) {
    return jsonResponse({ ok: false, message: flashcardNotFoundMessage(locale) }, 404);
  }

  await touchFlashcardSetUpdatedAt(supabase, parsed.data.setId);

  return jsonResponse({ ok: true, card: data });
};
