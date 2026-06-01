import type { APIRoute } from "astro";
import { z } from "zod";
import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { jsonResponse } from "@/lib/api-json";
import { flashcardCreateErrorMessage } from "@/lib/flashcard-errors";
import { flashcardDraftValidationMessage, validateFlashcardDraft } from "@/lib/flashcard-draft-validation";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";

export const prerender = false;

const createBodySchema = z.object({
  setId: z.uuid(),
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
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_add_flashcard") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = createBodySchema.safeParse(body);
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
    .insert({
      set_id: parsed.data.setId,
      question: validated.card.question,
      answer: validated.card.answer,
    })
    .select("id, set_id, question, answer, due_at, created_at, updated_at")
    .single();

  if (error) {
    return jsonResponse({ ok: false, message: flashcardCreateErrorMessage(locale, error) }, 403);
  }

  await touchFlashcardSetUpdatedAt(supabase, parsed.data.setId);

  return jsonResponse({ ok: true, card: data });
};
