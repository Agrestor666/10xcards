import type { APIRoute } from "astro";
import { z } from "zod";
import { MAX_SOURCE_TEXT_CHARS } from "@/lib/ai-generation-limits";
import { jsonResponse } from "@/lib/api-json";
import { generateFlashcardsFromText } from "@/lib/openrouter-generate";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const generateBodySchema = z.object({
  text: z.string(),
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
    return jsonResponse({ ok: false, message: "Please sign in to generate flashcards." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = generateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const text = parsed.data.text.trim();
  if (!text) {
    return jsonResponse({ ok: false, message: "Paste some text to generate flashcards." }, 400);
  }

  if (text.length > MAX_SOURCE_TEXT_CHARS) {
    return jsonResponse(
      {
        ok: false,
        message: `Text must be at most ${MAX_SOURCE_TEXT_CHARS} characters.`,
      },
      400,
    );
  }

  const result = await generateFlashcardsFromText(text);

  if (!result.ok) {
    return jsonResponse({ ok: false, message: result.message }, 502);
  }

  return jsonResponse({ ok: true, cards: result.cards });
};
