import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { gradeCard, type GradeRating } from "@/lib/srs/grade-card";
import { createClient } from "@/lib/supabase";

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
  cardId: z.uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]) satisfies z.ZodType<GradeRating>,
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
    return jsonResponse({ ok: false, message: "Please sign in to continue." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = gradeBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const cardResult = await supabase
    .from("flashcards")
    .select("id, due_at, srs_state")
    .eq("id", parsed.data.cardId)
    .maybeSingle();

  if (cardResult.error) {
    return jsonResponse({ ok: false, message: cardResult.error.message }, 403);
  }

  const cardRowParse = cardScheduleSchema.nullable().safeParse(cardResult.data);
  if (!cardRowParse.success) {
    return jsonResponse({ ok: false, message: "Invalid response." }, 500);
  }

  const cardRow = cardRowParse.data;
  if (!cardRow) {
    return jsonResponse({ ok: false, message: "Flashcard not found." }, 404);
  }

  const now = new Date();
  const persisted = gradeCard(
    {
      due_at: cardRow.due_at ?? now.toISOString(),
      srs_state: (cardRow.srs_state ?? {}) as Record<string, unknown>,
    },
    now,
    parsed.data.rating,
  );

  const updateResult = await supabase
    .from("flashcards")
    .update({
      due_at: persisted.due_at,
      srs_state: persisted.srs_state,
      updated_at: now.toISOString(),
    })
    .eq("id", parsed.data.cardId)
    .select("id, due_at")
    .maybeSingle();

  if (updateResult.error) {
    return jsonResponse({ ok: false, message: updateResult.error.message }, 403);
  }

  const updatedParse = updatedSchema.nullable().safeParse(updateResult.data);
  if (!updatedParse.success) {
    return jsonResponse({ ok: false, message: "Invalid response." }, 500);
  }

  const updated = updatedParse.data;
  if (!updated) return jsonResponse({ ok: false, message: "Flashcard not found." }, 404);

  return jsonResponse({ ok: true, updated });
};
