import { describe, expect, it, vi } from "vitest";

import { MAX_SOURCE_TEXT_CHARS, MAX_TOPIC_CHARS } from "@/lib/ai-generation-limits";
import { handleAiGenerateRequest, type AiGenerateHandlerSupabase } from "@/lib/ai-generate-handler";
import { t } from "@/lib/i18n";
import type { GenerateFlashcardsResult } from "@/lib/openrouter-generate";

const SENTINEL = "E2E_HANDLER_PRIVACY_SENTINEL_xyzzy_42";

const AUTHENTICATED_USER = { id: "user-abc-123" };

function createSupabaseMock(overrides?: Partial<AiGenerateHandlerSupabase>): AiGenerateHandlerSupabase & {
  fromCalls: string[];
} {
  const fromCalls: string[] = [];
  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    return {};
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: AUTHENTICATED_USER },
        error: null,
      }),
    },
    from,
    fromCalls,
    ...overrides,
  };
}

/** test-plan Risk #3 — pasted source text must not echo in responses or trigger DB writes */
describe("handleAiGenerateRequest (Risk #3)", () => {
  it("success response never echoes sentinel source text and does not call supabase.from", async () => {
    const supabase = createSupabaseMock();
    const generateFlashcardsFromText = vi.fn().mockResolvedValue({
      ok: true,
      cards: [{ question: "Q?", answer: "A." }],
    } satisfies GenerateFlashcardsResult);

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { text: SENTINEL },
      generateFlashcardsFromText,
    });

    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(supabase.fromCalls).toHaveLength(0);
    expect(generateFlashcardsFromText).toHaveBeenCalledWith(SENTINEL);
  });

  it("error response never echoes sentinel source text", async () => {
    const supabase = createSupabaseMock();
    const generateFlashcardsFromText = vi.fn().mockResolvedValue({
      ok: false,
      errorKey: "generator.error.generate",
    } satisfies GenerateFlashcardsResult);

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { text: SENTINEL },
      generateFlashcardsFromText,
    });

    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 401 without calling generate when unauthenticated", async () => {
    const supabase = createSupabaseMock({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
    const generateFlashcardsFromText = vi.fn();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { text: SENTINEL },
      generateFlashcardsFromText,
    });

    expect(result.status).toBe(401);
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
  });
});

/** S-13 topic prompts must not echo in responses or trigger DB writes (Risk #3) */
describe("handleAiGenerateRequest topic mode (S-13, Risk #3)", () => {
  function topicGenerators() {
    const generateFlashcardsFromText = vi.fn();
    const generateFlashcardsFromTopic = vi.fn().mockResolvedValue({
      ok: true,
      cards: [{ question: "Q?", answer: "A." }],
    } satisfies GenerateFlashcardsResult);

    return { generateFlashcardsFromText, generateFlashcardsFromTopic };
  }

  it("calls generateFlashcardsFromTopic for { topic } and never echoes the sentinel or writes to supabase", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic } = topicGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { topic: SENTINEL },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, cards: [{ question: "Q?", answer: "A." }] });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(supabase.fromCalls).toHaveLength(0);
    expect(generateFlashcardsFromTopic).toHaveBeenCalledWith(SENTINEL);
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
  });

  it("calls generateFlashcardsFromTopic when mode is topic", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic } = topicGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { mode: "topic", topic: SENTINEL },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
    });

    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(generateFlashcardsFromTopic).toHaveBeenCalledWith(SENTINEL);
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 generator.error.enter_topic for empty or whitespace topics", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic } = topicGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { topic: "   " },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "generator.error.enter_topic") });
    expect(generateFlashcardsFromTopic).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 generator.error.topic_max for an over-max topic without echoing the input", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic } = topicGenerators();
    const overMax = "x".repeat(MAX_TOPIC_CHARS + 1);

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { topic: overMax },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      message: t("en", "generator.error.topic_max", { max: MAX_TOPIC_CHARS }),
    });
    expect(JSON.stringify(result.body)).not.toContain(overMax);
    expect(generateFlashcardsFromTopic).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 401 without calling generate when an unauthenticated topic request arrives", async () => {
    const supabase = createSupabaseMock({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
    const { generateFlashcardsFromText, generateFlashcardsFromTopic } = topicGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { mode: "topic", topic: SENTINEL },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
    });

    expect(result.status).toBe(401);
    expect(generateFlashcardsFromTopic).not.toHaveBeenCalled();
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 api.error.invalid_body when both text and topic are sent without a mode", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic } = topicGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { text: "notes", topic: SENTINEL },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
    expect(generateFlashcardsFromTopic).not.toHaveBeenCalled();
  });
});

/** S-14 transcript mode must dispatch to generateFlashcardsFromTranscript and preserve Risk #3 privacy */
describe("handleAiGenerateRequest transcript mode (S-14, Risk #3)", () => {
  function transcriptGenerators() {
    const generateFlashcardsFromText = vi.fn();
    const generateFlashcardsFromTopic = vi.fn();
    const generateFlashcardsFromTranscript = vi.fn().mockResolvedValue({
      ok: true,
      cards: [{ question: "Q?", answer: "A." }],
    } satisfies GenerateFlashcardsResult);

    return {
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
      generateFlashcardsFromTranscript,
    };
  }

  it("calls generateFlashcardsFromTranscript for { mode: 'transcript', text } and never calls paste or topic generators", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic, generateFlashcardsFromTranscript } =
      transcriptGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { mode: "transcript", text: `  ${SENTINEL}  ` },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
      generateFlashcardsFromTranscript,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, cards: [{ question: "Q?", answer: "A." }] });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(generateFlashcardsFromTranscript).toHaveBeenCalledWith(SENTINEL);
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
    expect(generateFlashcardsFromTopic).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 generator.error.paste_text for empty or whitespace transcript", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic, generateFlashcardsFromTranscript } =
      transcriptGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { mode: "transcript", text: "   " },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
      generateFlashcardsFromTranscript,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "generator.error.paste_text") });
    expect(generateFlashcardsFromTranscript).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 generator.error.text_max for over-max transcript without echoing the input", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic, generateFlashcardsFromTranscript } =
      transcriptGenerators();
    const overMax = `${SENTINEL}${"x".repeat(MAX_SOURCE_TEXT_CHARS + 1)}`;

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { mode: "transcript", text: overMax },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
      generateFlashcardsFromTranscript,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      message: t("en", "generator.error.text_max", { max: MAX_SOURCE_TEXT_CHARS }),
    });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(generateFlashcardsFromTranscript).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 api.error.invalid_body when mode is transcript and topic is also present", async () => {
    const supabase = createSupabaseMock();
    const { generateFlashcardsFromText, generateFlashcardsFromTopic, generateFlashcardsFromTranscript } =
      transcriptGenerators();

    const result = await handleAiGenerateRequest({
      locale: "en",
      supabase,
      body: { mode: "transcript", text: "notes", topic: SENTINEL },
      generateFlashcardsFromText,
      generateFlashcardsFromTopic,
      generateFlashcardsFromTranscript,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(generateFlashcardsFromTranscript).not.toHaveBeenCalled();
    expect(generateFlashcardsFromText).not.toHaveBeenCalled();
    expect(generateFlashcardsFromTopic).not.toHaveBeenCalled();
  });
});
