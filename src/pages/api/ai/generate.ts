import type { APIRoute } from "astro";
import { z } from "zod";
import { MAX_SOURCE_TEXT_CHARS } from "@/lib/ai-generation-limits";
import { jsonResponse } from "@/lib/api-json";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";
import { generateFlashcardsFromText } from "@/lib/openrouter-generate";

export const prerender = false;

const generateBodySchema = z.object({
  text: z.string(),
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
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_generate") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = generateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const text = parsed.data.text.trim();
  if (!text) {
    return jsonResponse({ ok: false, message: t(locale, "generator.error.paste_text") }, 400);
  }

  if (text.length > MAX_SOURCE_TEXT_CHARS) {
    return jsonResponse(
      {
        ok: false,
        message: t(locale, "generator.error.text_max", { max: MAX_SOURCE_TEXT_CHARS }),
      },
      400,
    );
  }

  const result = await generateFlashcardsFromText(text);

  if (!result.ok) {
    return jsonResponse({ ok: false, errorKey: result.errorKey }, 502);
  }

  return jsonResponse({ ok: true, cards: result.cards });
};
