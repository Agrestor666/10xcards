import { MAX_SOURCE_TEXT_CHARS, MAX_TOPIC_CHARS } from "@/lib/ai-generation-limits";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import type { GenerateFlashcardsResult } from "@/lib/openrouter-generate";

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
  generateFlashcardsFromTopic?: (topic: string) => Promise<GenerateFlashcardsResult>;
  generateFlashcardsFromTranscript?: (text: string) => Promise<GenerateFlashcardsResult>;
}

export interface HandleAiGenerateRequestResult {
  status: number;
  body: Record<string, unknown>;
}

type ClassifiedGenerateBody =
  | { kind: "text"; text: string }
  | { kind: "topic"; topic: string }
  | { kind: "transcript"; text: string }
  | { kind: "invalid" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function classifyGenerateBody(body: unknown): ClassifiedGenerateBody {
  if (!isRecord(body)) {
    return { kind: "invalid" };
  }

  const mode = body.mode;
  const hasTextKey = "text" in body;
  const hasTopicKey = "topic" in body;
  const textIsString = typeof body.text === "string";
  const topicIsString = typeof body.topic === "string";
  const modeDisambiguates = mode === "text" || mode === "topic";

  if (mode === "transcript") {
    if (hasTopicKey || !textIsString) {
      return { kind: "invalid" };
    }
    return { kind: "transcript", text: body.text as string };
  }

  if (hasTextKey && hasTopicKey && !modeDisambiguates) {
    return { kind: "invalid" };
  }

  if (mode === "topic" || (!hasTextKey && hasTopicKey && topicIsString)) {
    if (!topicIsString) {
      return { kind: "invalid" };
    }
    return { kind: "topic", topic: body.topic as string };
  }

  if (mode === "text" || (hasTextKey && textIsString && (mode === undefined || mode === "text"))) {
    if (!textIsString) {
      return { kind: "invalid" };
    }
    return { kind: "text", text: body.text as string };
  }

  return { kind: "invalid" };
}

function generationResultResponse(result: GenerateFlashcardsResult): HandleAiGenerateRequestResult {
  if (!result.ok) {
    return { status: 502, body: { ok: false, errorKey: result.errorKey } };
  }

  return { status: 200, body: { ok: true, cards: result.cards } };
}

export async function handleAiGenerateRequest(
  input: HandleAiGenerateRequestInput,
): Promise<HandleAiGenerateRequestResult> {
  const {
    locale,
    supabase,
    body,
    generateFlashcardsFromText,
    generateFlashcardsFromTopic,
    generateFlashcardsFromTranscript,
  } = input;

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

  const classified = classifyGenerateBody(body);
  if (classified.kind === "invalid") {
    return { status: 400, body: { ok: false, message: t(locale, "api.error.invalid_body") } };
  }

  if (classified.kind === "topic") {
    const topic = classified.topic.trim();
    if (!topic) {
      return { status: 400, body: { ok: false, message: t(locale, "generator.error.enter_topic") } };
    }

    if (topic.length > MAX_TOPIC_CHARS) {
      return {
        status: 400,
        body: {
          ok: false,
          message: t(locale, "generator.error.topic_max", { max: MAX_TOPIC_CHARS }),
        },
      };
    }

    if (!generateFlashcardsFromTopic) {
      return { status: 502, body: { ok: false, errorKey: "generator.error.generate" } };
    }

    return generationResultResponse(await generateFlashcardsFromTopic(topic));
  }

  const text = classified.text.trim();
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

  if (classified.kind === "transcript") {
    if (!generateFlashcardsFromTranscript) {
      return { status: 502, body: { ok: false, errorKey: "generator.error.generate" } };
    }

    return generationResultResponse(await generateFlashcardsFromTranscript(text));
  }

  return generationResultResponse(await generateFlashcardsFromText(text));
}
