import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { flashcardDeleteErrorMessage } from "@/lib/flashcard-errors";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { touchFlashcardSetUpdatedAt } from "@/lib/flashcard-set-touch";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const deleteBodySchema = z.object({
  id: z.uuid(),
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
    return jsonResponse({ ok: false, message: "Please sign in to delete a flashcard." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const { data, error } = await supabase.from("flashcards").delete().eq("id", parsed.data.id).select("id, set_id");

  if (error) {
    return jsonResponse({ ok: false, message: flashcardDeleteErrorMessage(error) }, 403);
  }

  if (data.length === 0) {
    return jsonResponse({ ok: false, message: "Flashcard not found." }, 404);
  }

  await touchFlashcardSetUpdatedAt(supabase, z.uuid().parse(data[0].set_id));

  return jsonResponse({ ok: true });
};
