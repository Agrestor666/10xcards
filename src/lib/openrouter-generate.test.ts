import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_CARD_FIELD_CHARS, OPENROUTER_REQUEST_TIMEOUT_MS } from "@/lib/ai-generation-limits";
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

import { generateFlashcardsFromText } from "@/lib/openrouter-generate";

const SOURCE_TEXT = "Mitochondria are the powerhouse of the cell.";

const EXPECTED_CARDS = [{ question: "What organelle powers the cell?", answer: "Mitochondria" }];

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

describe("openrouter-envelopes (test helpers)", () => {
  it("builds a chat completion envelope with string content", () => {
    expect(openRouterChatEnvelope('{"cards":[]}')).toEqual({
      choices: [{ message: { content: '{"cards":[]}' } }],
    });
  });
});
