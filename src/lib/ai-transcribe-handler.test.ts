import { describe, expect, it, vi } from "vitest";

import { MAX_PHOTO_BYTES } from "@/lib/ai-generation-limits";
import type { AiGenerateHandlerSupabase } from "@/lib/ai-generate-handler";
import { handleAiTranscribeRequest } from "@/lib/ai-transcribe-handler";
import { t } from "@/lib/i18n";
import type { TranscribeImageResult } from "@/lib/openrouter-generate";

const SENTINEL = "E2E_TRANSCRIBE_PRIVACY_SENTINEL_xyzzy";
const VALID_JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const VALID_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

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

describe("handleAiTranscribeRequest (S-14, Risk #3, Risk #5)", () => {
  it("returns 401 without calling transcribeImage when unauthenticated", async () => {
    const supabase = createSupabaseMock({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
    const transcribeImage = vi.fn();

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [VALID_JPEG_DATA_URL] },
      transcribeImage,
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, message: t("en", "api.error.sign_in_generate") });
    expect(transcribeImage).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain(VALID_JPEG_DATA_URL);
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 503 when supabase is null", async () => {
    const transcribeImage = vi.fn();

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase: null,
      body: { images: [VALID_JPEG_DATA_URL] },
      transcribeImage,
    });

    expect(result.status).toBe(503);
    expect(transcribeImage).not.toHaveBeenCalled();
  });

  it("returns 400 when images is missing or empty", async () => {
    const supabase = createSupabaseMock();
    const transcribeImage = vi.fn();

    const missingResult = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: {},
      transcribeImage,
    });
    expect(missingResult.status).toBe(400);
    expect(missingResult.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });

    const emptyResult = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [] },
      transcribeImage,
    });
    expect(emptyResult.status).toBe(400);
    expect(emptyResult.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
    expect(transcribeImage).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 when images has four items (over MAX_PHOTO_COUNT)", async () => {
    const supabase = createSupabaseMock();
    const transcribeImage = vi.fn();

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: {
        images: [VALID_JPEG_DATA_URL, VALID_JPEG_DATA_URL, VALID_JPEG_DATA_URL, VALID_JPEG_DATA_URL],
      },
      transcribeImage,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
    expect(transcribeImage).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 for an invalid mime type or malformed data URL", async () => {
    const supabase = createSupabaseMock();
    const transcribeImage = vi.fn();

    const svgResult = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [`data:image/svg+xml;base64,${btoa(SENTINEL)}`] },
      transcribeImage,
    });

    expect(svgResult.status).toBe(400);
    expect(svgResult.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
    expect(JSON.stringify(svgResult.body)).not.toContain(SENTINEL);
    expect(transcribeImage).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 for an oversize image without echoing the payload", async () => {
    const supabase = createSupabaseMock();
    const transcribeImage = vi.fn();
    const minFourCharGroups = Math.ceil((MAX_PHOTO_BYTES + 1) / 3);
    const sentinelBase64 = "QUJDREVG"; // "ABCDEF"
    const paddingGroups = Math.max(1, minFourCharGroups - sentinelBase64.length / 4);
    const oversizeDataUrl = `data:image/jpeg;base64,${sentinelBase64}${"AAAA".repeat(paddingGroups)}`;

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [oversizeDataUrl] },
      transcribeImage,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
    expect(JSON.stringify(result.body)).not.toContain(sentinelBase64);
    expect(JSON.stringify(result.body)).not.toContain("data:image/jpeg");
    expect(transcribeImage).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("skips a blank photo by 1-based index and concatenates readable photos in order without echoing data URLs", async () => {
    const supabase = createSupabaseMock();
    const firstUrl = `data:image/jpeg;base64,${btoa(`${SENTINEL}_1`)}`;
    const blankUrl = `data:image/png;base64,${btoa(`${SENTINEL}_2`)}`;
    const thirdUrl = `data:image/webp;base64,${btoa(`${SENTINEL}_3`)}`;

    const transcribeImage = vi.fn((url: string): Promise<TranscribeImageResult> => {
      if (url === firstUrl) {
        return Promise.resolve({ ok: true, text: "  First page line  " });
      }
      if (url === blankUrl) {
        return Promise.resolve({ ok: true, text: "   \n\t  " });
      }
      return Promise.resolve({ ok: true, text: "Third page line" });
    });

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [firstUrl, blankUrl, thirdUrl] },
      transcribeImage,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      text: "First page line\n\nThird page line",
      skipped: [2],
    });
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("data:image/");
    expect(serialized).not.toContain(btoa(`${SENTINEL}_1`));
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 generator.error.no_readable_text when all photos transcribe to whitespace", async () => {
    const supabase = createSupabaseMock();
    const transcribeImage = vi.fn().mockResolvedValue({
      ok: true,
      text: "   \n  ",
    } satisfies TranscribeImageResult);

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [VALID_JPEG_DATA_URL, VALID_PNG_DATA_URL] },
      transcribeImage,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "generator.error.no_readable_text") });
    expect(JSON.stringify(result.body)).not.toContain("data:image/");
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 502 with errorKey and no text field when any vision call fails", async () => {
    const supabase = createSupabaseMock();
    const transcribeImage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: "Readable page 1" } satisfies TranscribeImageResult)
      .mockResolvedValueOnce({ ok: false, errorKey: "generator.error.timeout" } satisfies TranscribeImageResult);

    const result = await handleAiTranscribeRequest({
      locale: "en",
      supabase,
      body: { images: [VALID_JPEG_DATA_URL, VALID_PNG_DATA_URL] },
      transcribeImage,
    });

    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, errorKey: "generator.error.timeout" });
    expect(result.body).not.toHaveProperty("text");
    expect(JSON.stringify(result.body)).not.toContain("Readable page 1");
    expect(JSON.stringify(result.body)).not.toContain("data:image/");
    expect(supabase.fromCalls).toHaveLength(0);
  });
});
