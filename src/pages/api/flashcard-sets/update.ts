import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { flashcardSetUpdateErrorMessage, SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { validateFlashcardSetName } from "@/lib/flashcard-set-name";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const updateBodySchema = z.object({
  id: z.uuid(),
  name: z.string(),
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
    return jsonResponse({ ok: false, message: "Please sign in to rename a set." }, 401);
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

  const validated = validateFlashcardSetName(parsed.data.name);
  if (!validated.ok) {
    return jsonResponse({ ok: false, message: validated.error }, 400);
  }

  const { data, error } = await supabase
    .from("flashcard_sets")
    .update({
      name: validated.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .select("id, name, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, message: flashcardSetUpdateErrorMessage(error) }, 403);
  }

  if (!data) {
    return jsonResponse({ ok: false, message: "Set not found." }, 404);
  }

  return jsonResponse({ ok: true, set: data });
};
