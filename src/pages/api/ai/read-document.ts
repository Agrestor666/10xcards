import type { APIRoute } from "astro";
import { handleAiReadDocumentRequest } from "@/lib/ai-read-document-handler";
import { jsonResponse } from "@/lib/api-json";
import { readDocumentText } from "@/lib/document-text";
import { getLocaleFromContext } from "@/lib/locale";
import { transcribePdf } from "@/lib/openrouter-generate";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const locale = getLocaleFromContext(context);
  const result = await handleAiReadDocumentRequest({
    locale,
    supabase: context.locals.supabase,
    request: context.request,
    readDocumentText,
    transcribePdf,
  });

  return jsonResponse(result.body, result.status);
};
