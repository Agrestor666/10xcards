import { z } from "zod";

import { MAX_SOURCE_TEXT_CHARS } from "@/lib/ai-generation-limits";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import type { GenerateFlashcardsResult } from "@/lib/openrouter-generate";

const generateBodySchema = z.object({
  text: z.string(),
});

export interface AiGenerateHandlerSupabase {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  /** Present so tests can assert this is never called during generate (Risk #3). */
  from: (table: string) => unknown;
}

export interface HandleAiGenerateRequestInput {
  locale: AppLocale;
  supabase: AiGenerateHandlerSupabase | null;
  body: unknown;
  generateFlashcardsFromText: (text: string) => Promise<GenerateFlashcardsResult>;
}

export interface HandleAiGenerateRequestResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleAiGenerateRequest(
  input: HandleAiGenerateRequestInput,
): Promise<HandleAiGenerateRequestResult> {
  const { locale, supabase, body, generateFlashcardsFromText } = input;

  if (!supabase) {
    return { status: 503, body: { ok: false, message: supabaseNotConfiguredMessage(locale) } };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: 401, body: { ok: false, message: t(locale, "api.error.sign_in_generate") } };
  }

  const parsed = generateBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, message: t(locale, "api.error.invalid_body") } };
  }

  const text = parsed.data.text.trim();
  if (!text) {
    return { status: 400, body: { ok: false, message: t(locale, "generator.error.paste_text") } };
  }

  if (text.length > MAX_SOURCE_TEXT_CHARS) {
    return {
      status: 400,
      body: {
        ok: false,
        message: t(locale, "generator.error.text_max", { max: MAX_SOURCE_TEXT_CHARS }),
      },
    };
  }

  const result = await generateFlashcardsFromText(text);

  if (!result.ok) {
    return { status: 502, body: { ok: false, errorKey: result.errorKey } };
  }

  return { status: 200, body: { ok: true, cards: result.cards } };
}
