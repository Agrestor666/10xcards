import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  MAX_CARD_FIELD_CHARS,
  OPENROUTER_REQUEST_TIMEOUT_MS,
  OPENROUTER_WEB_SEARCH_MAX_RESULTS,
} from "@/lib/ai-generation-limits";
import {
  openRouterChatEnvelope,
  openRouterHttpErrorResponse,
  openRouterSuccessResponse,
} from "@/lib/test-fixtures/openrouter-envelopes";

const mockApiKey = vi.hoisted(() => ({ value: "test-key" }));

vi.mock("astro:env/server", () => ({
  get OPENROUTER_API_KEY() {
    return mockApiKey.value;
  },
}));

import {
  generateFlashcardsFromText,
  generateFlashcardsFromTopic,
  generateFlashcardsFromTranscript,
  transcribeImage,
} from "@/lib/openrouter-generate";

const SOURCE_TEXT = "Mitochondria are the powerhouse of the cell.";

const EXPECTED_CARDS = [{ question: "What organelle powers the cell?", answer: "Mitochondria" }];

const openRouterRequestSchema = z.object({
  response_format: z.object({ type: z.string() }),
  plugins: z.array(
    z.object({
      id: z.string(),
      max_results: z.number(),
      search_prompt: z.string(),
    }),
  ),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }),
  ),
});

function readOpenRouterRequest(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") {
    throw new Error("expected string fetch body");
  }

  return openRouterRequestSchema.parse(JSON.parse(init.body) as unknown);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function stubFetchUntilAborted(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const abort = () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        };

        if (init?.signal?.aborted) {
          abort();
          return;
        }

        init?.signal?.addEventListener("abort", abort, { once: true });
      });
    }),
  );
}

/** test-plan Risk #4 — malformed/empty AI must surface safe errors, never false success */
describe("generateFlashcardsFromText (Risk #4)", () => {
  beforeEach(() => {
    mockApiKey.value = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns usable cards from a valid wrapped LLM payload", async () => {
    stubFetch(openRouterSuccessResponse(JSON.stringify({ cards: EXPECTED_CARDS })));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
  });

  it("returns usable cards from a valid bare array LLM payload", async () => {
    stubFetch(openRouterSuccessResponse(JSON.stringify(EXPECTED_CARDS)));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
  });

  it("returns usable cards when message content is markdown-fenced JSON", async () => {
    const fenced = `\`\`\`json\n${JSON.stringify({ cards: EXPECTED_CARDS })}\n\`\`\``;
    stubFetch(openRouterSuccessResponse(fenced));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
  });

  it("returns generator.error.generate when message content is invalid JSON", async () => {
    stubFetch(openRouterSuccessResponse("not valid json {{{"));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.generate when LLM payload has wrong top-level shape", async () => {
    stubFetch(openRouterSuccessResponse(JSON.stringify({ items: EXPECTED_CARDS })));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.no_valid_drafts when all card pairs are empty after trim", async () => {
    const emptyCards = [{ question: "   ", answer: "" }];
    stubFetch(openRouterSuccessResponse(JSON.stringify({ cards: emptyCards })));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.no_valid_drafts" });
  });

  it("returns generator.error.generate when a card field exceeds max length", async () => {
    const oversize = "x".repeat(MAX_CARD_FIELD_CHARS + 1);
    const cards = [{ question: oversize, answer: "short" }];
    stubFetch(openRouterSuccessResponse(JSON.stringify({ cards })));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.generate on HTTP 500 from OpenRouter", async () => {
    stubFetch(openRouterHttpErrorResponse(500));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.timeout when the OpenRouter request times out", async () => {
    vi.useFakeTimers();
    stubFetchUntilAborted();

    const resultPromise = generateFlashcardsFromText(SOURCE_TEXT);
    await vi.advanceTimersByTimeAsync(OPENROUTER_REQUEST_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result).toEqual({ ok: false, errorKey: "generator.error.timeout" });
  });

  it("returns generator.error.generate when OpenRouter response envelope is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ unexpected: "shape" })));

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.generate when OPENROUTER_API_KEY is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockApiKey.value = undefined;

    const result = await generateFlashcardsFromText(SOURCE_TEXT);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** S-13 topic generation — web plugin payload plus Risk #4 malformed output */
describe("generateFlashcardsFromTopic (S-13, Risk #4)", () => {
  const TOPIC = "Fotosynteza — faza jasna i ciemna";

  beforeEach(() => {
    mockApiKey.value = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends the web search plugin and returns cards from a valid wrapped JSON payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openRouterSuccessResponse(JSON.stringify({ cards: EXPECTED_CARDS })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
    const requestBody = readOpenRouterRequest(fetchMock.mock.calls[0]?.[1] as RequestInit | undefined);
    expect(requestBody.response_format).toEqual({ type: "json_object" });
    expect(OPENROUTER_WEB_SEARCH_MAX_RESULTS).toBe(5);
    expect(requestBody.plugins).toHaveLength(1);
    expect(requestBody.plugins[0]).toMatchObject({ id: "web", max_results: 5 });
    expect(requestBody.plugins[0]?.search_prompt.length).toBeGreaterThan(0);
    expect(requestBody.messages[0]?.role).toBe("system");
    expect(requestBody.messages[0]?.content.length).toBeGreaterThan(0);
    expect(requestBody.messages[1]).toEqual({ role: "user", content: TOPIC });
  });

  it("returns usable cards from a valid bare array LLM payload", async () => {
    stubFetch(openRouterSuccessResponse(JSON.stringify(EXPECTED_CARDS)));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
  });

  it("returns usable cards when message content is markdown-fenced JSON", async () => {
    const fenced = `\`\`\`json\n${JSON.stringify({ cards: EXPECTED_CARDS })}\n\`\`\``;
    stubFetch(openRouterSuccessResponse(fenced));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
  });

  it("returns generator.error.generate when message content is invalid JSON", async () => {
    stubFetch(openRouterSuccessResponse("not valid json {{{"));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.no_valid_drafts when all card pairs are empty after trim", async () => {
    const emptyCards = [{ question: "   ", answer: "" }];
    stubFetch(openRouterSuccessResponse(JSON.stringify({ cards: emptyCards })));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.no_valid_drafts" });
  });

  it("returns generator.error.generate when a card field exceeds max length", async () => {
    const oversize = "x".repeat(MAX_CARD_FIELD_CHARS + 1);
    const cards = [{ question: oversize, answer: "short" }];
    stubFetch(openRouterSuccessResponse(JSON.stringify({ cards })));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.generate on HTTP 500 from OpenRouter", async () => {
    stubFetch(openRouterHttpErrorResponse(500));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.timeout when the OpenRouter request times out", async () => {
    vi.useFakeTimers();
    stubFetchUntilAborted();

    const resultPromise = generateFlashcardsFromTopic(TOPIC);
    await vi.advanceTimersByTimeAsync(OPENROUTER_REQUEST_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result).toEqual({ ok: false, errorKey: "generator.error.timeout" });
  });

  it("returns generator.error.generate when OpenRouter response envelope is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ unexpected: "shape" })));

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
  });

  it("returns generator.error.generate when OPENROUTER_API_KEY is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockApiKey.value = undefined;

    const result = await generateFlashcardsFromTopic(TOPIC);

    expect(result).toEqual({ ok: false, errorKey: "generator.error.generate" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("transcribeImage and generateFlashcardsFromTranscript (S-14, Risk #4)", () => {
  const SAMPLE_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

  beforeEach(() => {
    mockApiKey.value = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends a content array with text instruction before image_url and omits response_format", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openRouterSuccessResponse("Transcribed line one\nLine two"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeImage(SAMPLE_DATA_URL);

    expect(result).toEqual({ ok: true, text: "Transcribed line one\nLine two" });
    const rawInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(typeof rawInit?.body).toBe("string");
    const parsedBody = JSON.parse(rawInit?.body as string) as Record<string, unknown>;
    expect(parsedBody).not.toHaveProperty("response_format");

    const visionSchema = z.object({
      model: z.string(),
      messages: z.array(
        z.object({
          role: z.literal("user"),
          content: z.tuple([
            z.object({ type: z.literal("text"), text: z.string().min(1) }),
            z.object({
              type: z.literal("image_url"),
              image_url: z.object({ url: z.string() }),
            }),
          ]),
        }),
      ),
    });
    const visionBody = visionSchema.parse(parsedBody);
    expect(visionBody.messages[0]?.content[1].image_url.url).toBe(SAMPLE_DATA_URL);
  });

  it("returns generator.error.timeout when transcribeImage times out", async () => {
    vi.useFakeTimers();
    stubFetchUntilAborted();

    const resultPromise = transcribeImage(SAMPLE_DATA_URL);
    await vi.advanceTimersByTimeAsync(OPENROUTER_REQUEST_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result).toEqual({ ok: false, errorKey: "generator.error.timeout" });
  });

  it("returns generator.error.generate on HTTP 500 or missing API key in transcribeImage", async () => {
    stubFetch(openRouterHttpErrorResponse(500));
    expect(await transcribeImage(SAMPLE_DATA_URL)).toEqual({
      ok: false,
      errorKey: "generator.error.generate",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockApiKey.value = undefined;
    expect(await transcribeImage(SAMPLE_DATA_URL)).toEqual({
      ok: false,
      errorKey: "generator.error.generate",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("generateFlashcardsFromTranscript requests 8 to 12 cards in JSON format and validates drafts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openRouterSuccessResponse(JSON.stringify({ cards: EXPECTED_CARDS })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFlashcardsFromTranscript(SOURCE_TEXT);

    expect(result).toEqual({ ok: true, cards: EXPECTED_CARDS });
    const rawInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const parsedBody = z
      .object({
        response_format: z.object({ type: z.literal("json_object") }),
        messages: z.tuple([
          z.object({ role: z.literal("system"), content: z.string() }),
          z.object({ role: z.literal("user"), content: z.string() }),
        ]),
      })
      .parse(JSON.parse(rawInit?.body as string) as unknown);

    expect(parsedBody.messages[0].content).toMatch(/8 to 12/);
    expect(parsedBody.messages[1].content).toBe(SOURCE_TEXT);
  });
});

describe("openrouter-envelopes (test helpers)", () => {
  it("builds a chat completion envelope with string content", () => {
    expect(openRouterChatEnvelope('{"cards":[]}')).toEqual({
      choices: [{ message: { content: '{"cards":[]}' } }],
    });
  });
});
