import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { flashcardNotFoundMessage } from "@/lib/flashcard-errors";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";
import { gradeCard, type GradeRating } from "@/lib/srs/grade-card";

export const prerender = false;

interface CardScheduleRow {
  id: string;
  due_at: string | null;
  srs_state: unknown;
}

interface UpdatedRow {
  id: string;
  due_at: string | null;
}

const cardScheduleSchema: z.ZodType<CardScheduleRow> = z.object({
  id: z.string(),
  due_at: z.string().nullable(),
  srs_state: z.unknown(),
});

const updatedSchema: z.ZodType<UpdatedRow> = z.object({
  id: z.string(),
  due_at: z.string().nullable(),
});

const gradeBodySchema = z.object({
  setId: z.uuid(),
  cardId: z.uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]) satisfies z.ZodType<GradeRating>,
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
    return jsonResponse({ ok: false, message: t(locale, "api.error.unauthorized") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = gradeBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const cardResult = await supabase
    .from("flashcards")
    .select("id, due_at, srs_state")
    .eq("id", parsed.data.cardId)
    .eq("set_id", parsed.data.setId)
    .maybeSingle();

  if (cardResult.error) {
    return jsonResponse({ ok: false, message: t(locale, "review.error.load") }, 403);
  }

  const cardRowParse = cardScheduleSchema.nullable().safeParse(cardResult.data);
  if (!cardRowParse.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_response") }, 500);
  }

  const cardRow = cardRowParse.data;
  if (!cardRow) {
    return jsonResponse({ ok: false, message: flashcardNotFoundMessage(locale) }, 404);
  }

  const now = new Date();
  let persisted;
  try {
    persisted = gradeCard(
      {
        due_at: cardRow.due_at ?? now.toISOString(),
        srs_state: (cardRow.srs_state ?? {}) as Record<string, unknown>,
      },
      now,
      parsed.data.rating,
    );
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "review.error.invalid_schedule") }, 400);
  }

  const updateResult = await supabase
    .from("flashcards")
    .update({
      due_at: persisted.due_at,
      srs_state: persisted.srs_state,
      updated_at: now.toISOString(),
    })
    .eq("id", parsed.data.cardId)
    .eq("set_id", parsed.data.setId)
    .select("id, due_at")
    .maybeSingle();

  if (updateResult.error) {
    return jsonResponse({ ok: false, message: t(locale, "review.error.grade") }, 403);
  }

  const updatedParse = updatedSchema.nullable().safeParse(updateResult.data);
  if (!updatedParse.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_response") }, 500);
  }

  const updated = updatedParse.data;
  if (!updated) {
    return jsonResponse({ ok: false, message: flashcardNotFoundMessage(locale) }, 404);
  }

  return jsonResponse({ ok: true, updated });
};
