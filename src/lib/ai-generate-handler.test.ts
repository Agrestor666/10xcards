import { describe, expect, it, vi } from "vitest";

import { handleAiGenerateRequest, type AiGenerateHandlerSupabase } from "@/lib/ai-generate-handler";
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
