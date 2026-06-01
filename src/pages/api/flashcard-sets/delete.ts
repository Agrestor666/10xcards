import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { flashcardSetDeleteErrorMessage, SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
export const prerender = false;

const deleteBodySchema = z.object({
  id: z.uuid(),
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
    return jsonResponse({ ok: false, message: "Please sign in to delete a set." }, 401);
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

  const { data, error } = await supabase.from("flashcard_sets").delete().eq("id", parsed.data.id).select("id");

  if (error) {
    return jsonResponse({ ok: false, message: flashcardSetDeleteErrorMessage(error) }, 403);
  }

  if (data.length === 0) {
    return jsonResponse({ ok: false, message: "Set not found." }, 404);
  }

  return jsonResponse({ ok: true });
};
