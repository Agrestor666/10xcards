import { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT } from "@/lib/ai-generation-limits";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import type { AiGenerateHandlerSupabase } from "@/lib/ai-generate-handler";
import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import type { TranscribeImageResult } from "@/lib/openrouter-generate";

export interface HandleAiTranscribeRequestInput {
  locale: AppLocale;
  supabase: AiGenerateHandlerSupabase | null;
  body: unknown;
  transcribeImage: (dataUrl: string) => Promise<TranscribeImageResult>;
}

export interface HandleAiTranscribeRequestResult {
  status: number;
  body: Record<string, unknown>;
}

const IMAGE_DATA_URL_PREFIX = /^data:image\/(jpeg|png|webp|gif);base64,/i;
const BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodedByteLengthIfValidImageDataUrl(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const prefixMatch = IMAGE_DATA_URL_PREFIX.exec(value);
  if (!prefixMatch) {
    return null;
  }

  const base64 = value.slice(prefixMatch[0].length);
  if (base64.length === 0 || base64.length % 4 !== 0 || !BASE64_BODY_PATTERN.test(base64)) {
    return null;
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

function validateImagesArray(body: unknown): string[] | null {
  if (!isRecord(body) || !Array.isArray(body.images)) {
    return null;
  }

  const images = body.images;
  if (images.length < 1 || images.length > MAX_PHOTO_COUNT) {
    return null;
  }

  const validated: string[] = [];
  for (const item of images) {
    const decodedBytes = decodedByteLengthIfValidImageDataUrl(item);
    if (decodedBytes === null || decodedBytes < 1 || decodedBytes > MAX_PHOTO_BYTES) {
      return null;
    }
    validated.push(item as string);
  }

  return validated;
}

export async function handleAiTranscribeRequest(
  input: HandleAiTranscribeRequestInput,
): Promise<HandleAiTranscribeRequestResult> {
  const { locale, supabase, body, transcribeImage } = input;

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

  const images = validateImagesArray(body);
  if (!images) {
    return { status: 400, body: { ok: false, message: t(locale, "api.error.invalid_body") } };
  }

  const results = await Promise.all(images.map((image) => transcribeImage(image)));

  for (const result of results) {
    if (!result.ok) {
      return { status: 502, body: { ok: false, errorKey: result.errorKey } };
    }
  }

  const parts: string[] = [];
  const skipped: number[] = [];

  results.forEach((result, index) => {
    if (!result.ok) {
      return;
    }
    const trimmed = result.text.trim();
    if (!trimmed) {
      skipped.push(index + 1);
      return;
    }
    parts.push(trimmed);
  });

  if (parts.length === 0) {
    return { status: 400, body: { ok: false, message: t(locale, "generator.error.no_readable_text") } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      text: parts.join("\n\n"),
      skipped,
    },
  };
}
