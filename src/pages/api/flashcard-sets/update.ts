import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import {
  flashcardSetErrorMessage,
  flashcardSetUpdateErrorMessage,
  supabaseNotConfiguredMessage,
} from "@/lib/flashcard-set-errors";
import { validateFlashcardSetName } from "@/lib/flashcard-set-name";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";

export const prerender = false;

const updateBodySchema = z.object({
  id: z.uuid(),
  name: z.string(),
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
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_rename_set") }, 401);
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

  const validated = validateFlashcardSetName(parsed.data.name);
  if (!validated.ok) {
    return jsonResponse({ ok: false, message: flashcardSetErrorMessage(locale, validated.key) }, 400);
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
    return jsonResponse({ ok: false, message: flashcardSetUpdateErrorMessage(locale, error) }, 403);
  }

  if (!data) {
    return jsonResponse({ ok: false, message: t(locale, "sets.error.not_found") }, 404);
  }

  return jsonResponse({ ok: true, set: data });
};
