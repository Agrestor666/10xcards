import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { flashcardSetDeleteErrorMessage, supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";

export const prerender = false;

const deleteBodySchema = z.object({
  id: z.uuid(),
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
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_delete_set") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const { error, count } = await supabase.from("flashcard_sets").delete({ count: "exact" }).eq("id", parsed.data.id);

  if (error) {
    return jsonResponse({ ok: false, message: flashcardSetDeleteErrorMessage(locale, error) }, 403);
  }

  if (!count) {
    return jsonResponse({ ok: false, message: t(locale, "sets.error.not_found") }, 404);
  }

  return jsonResponse({ ok: true });
};
