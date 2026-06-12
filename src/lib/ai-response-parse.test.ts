import { describe, expect, it } from "vitest";

import { extractJsonPayload, parseCardsFromLlmPayload } from "@/lib/ai-response-parse";

const SAMPLE_CARDS = [{ question: "What is photosynthesis?", answer: "Converting light to chemical energy" }];

/** test-plan Risk #4 — LLM payload parsing must reject malformed shapes */
describe("extractJsonPayload (Risk #4)", () => {
  it("parses bare JSON object", () => {
    const raw = JSON.stringify({ cards: SAMPLE_CARDS });
    expect(extractJsonPayload(raw)).toEqual({ cards: SAMPLE_CARDS });
  });

  it("parses markdown-fenced JSON", () => {
    const fenced = `\`\`\`json\n${JSON.stringify({ cards: SAMPLE_CARDS })}\n\`\`\``;
    expect(extractJsonPayload(fenced)).toEqual({ cards: SAMPLE_CARDS });
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJsonPayload("not json at all")).toThrow();
  });
});

describe("parseCardsFromLlmPayload (Risk #4)", () => {
  it("accepts a valid wrapped object", () => {
    expect(parseCardsFromLlmPayload({ cards: SAMPLE_CARDS })).toEqual(SAMPLE_CARDS);
  });

  it("accepts a valid bare array", () => {
    expect(parseCardsFromLlmPayload(SAMPLE_CARDS)).toEqual(SAMPLE_CARDS);
  });

  it("returns null for wrong top-level shape", () => {
    expect(parseCardsFromLlmPayload({ items: SAMPLE_CARDS })).toBeNull();
    expect(parseCardsFromLlmPayload("unexpected string")).toBeNull();
  });

  it("returns null for empty array (schema min 1)", () => {
    expect(parseCardsFromLlmPayload([])).toBeNull();
  });

  it("returns null for wrapped empty cards array", () => {
    expect(parseCardsFromLlmPayload({ cards: [] })).toBeNull();
  });

  it("returns cards array for empty-string pairs (trim/drop deferred to validateFlashcardDrafts)", () => {
    // cardDraftSchema intentionally accepts empty strings at this layer;
    // empty pairs are dropped by validateFlashcardDrafts, not by the parser.
    // This test guards against adding .min(1) here which would silently
    // change the Risk #4 errorKey from no_valid_drafts → generate.
    const result = parseCardsFromLlmPayload([{ question: "", answer: "" }]);
    expect(result).not.toBeNull();
  });
});
