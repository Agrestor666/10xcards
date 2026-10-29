import type { APIRoute } from "astro";
import { handleAiTranscribeRequest } from "@/lib/ai-transcribe-handler";
import { jsonResponse } from "@/lib/api-json";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";
import { transcribeImage } from "@/lib/openrouter-generate";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const locale = getLocaleFromContext(context);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const result = await handleAiTranscribeRequest({
    locale,
    supabase: context.locals.supabase,
    body,
    transcribeImage,
  });

  return jsonResponse(result.body, result.status);
};
