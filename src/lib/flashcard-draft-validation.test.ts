import { describe, expect, it } from "vitest";

import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import { validateFlashcardDraft, validateFlashcardDrafts, type FlashcardDraft } from "@/lib/flashcard-draft-validation";

/** test-plan Risk #4 — malformed/empty AI must not yield false success */
describe("validateFlashcardDraft (Risk #4)", () => {
  it("accepts a single valid card after trim", () => {
    const result = validateFlashcardDraft({ question: "  What is X?  ", answer: "  It is Y.  " });
    expect(result).toEqual({ ok: true, card: { question: "What is X?", answer: "It is Y." } });
  });

  it("rejects empty question or answer", () => {
    expect(validateFlashcardDraft({ question: "", answer: "A" })).toEqual({ ok: false, key: "both_required" });
    expect(validateFlashcardDraft({ question: "Q", answer: "   " })).toEqual({ ok: false, key: "both_required" });
  });

  it("rejects oversize fields with max_chars", () => {
    const long = "a".repeat(MAX_CARD_FIELD_CHARS + 1);
    expect(validateFlashcardDraft({ question: long, answer: "ok" })).toEqual({ ok: false, key: "max_chars" });
    expect(validateFlashcardDraft({ question: "ok", answer: long })).toEqual({ ok: false, key: "max_chars" });
  });
});

describe("validateFlashcardDrafts (Risk #4)", () => {
  it("returns a single valid card", () => {
    const input: FlashcardDraft[] = [{ question: "Capital of France?", answer: "Paris" }];
    expect(validateFlashcardDrafts(input)).toEqual({ ok: true, cards: input });
  });

  it("drops empty pairs and returns no_valid when none remain", () => {
    const input: FlashcardDraft[] = [
      { question: "", answer: "orphan answer" },
      { question: "orphan question", answer: "   " },
    ];
    expect(validateFlashcardDrafts(input)).toEqual({ ok: false, key: "no_valid" });
  });

  it("returns max_chars fail-fast without processing remaining cards", () => {
    const oversize = "z".repeat(MAX_CARD_FIELD_CHARS + 5);
    const input: FlashcardDraft[] = [
      { question: "valid", answer: "card" },
      { question: oversize, answer: "too long" },
      { question: "never reached", answer: "skipped" },
    ];
    expect(validateFlashcardDrafts(input)).toEqual({ ok: false, key: "max_chars" });
  });

  it("returns only valid cards when input mixes valid and empty", () => {
    const input: FlashcardDraft[] = [
      { question: "  Q1 ", answer: " A1 " },
      { question: "", answer: "" },
      { question: "Q2", answer: "A2" },
    ];
    expect(validateFlashcardDrafts(input)).toEqual({
      ok: true,
      cards: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ],
    });
  });
});
