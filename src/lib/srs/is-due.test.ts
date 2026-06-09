import { describe, expect, it } from "vitest";

import { dueAsOfIso, isFlashcardDue } from "@/lib/srs/is-due";

const NOW = new Date("2026-06-08T12:00:00.000Z");

describe("dueAsOfIso", () => {
  it("returns UTC ISO string with Z suffix", () => {
    expect(dueAsOfIso(NOW)).toBe("2026-06-08T12:00:00.000Z");
  });
});

describe("isFlashcardDue", () => {
  it("returns true when due_at equals now", () => {
    expect(isFlashcardDue("2026-06-08T12:00:00.000Z", NOW)).toBe(true);
  });

  it("returns true when due_at is before now", () => {
    expect(isFlashcardDue("2026-06-08T11:59:59.999Z", NOW)).toBe(true);
  });

  it("returns false when due_at is after now", () => {
    expect(isFlashcardDue("2026-06-08T12:00:00.001Z", NOW)).toBe(false);
  });

  it("compares timezone-bearing ISO strings (Z format from toISOString)", () => {
    const now = new Date("2026-06-08T14:00:00.000+02:00");
    expect(dueAsOfIso(now)).toBe("2026-06-08T12:00:00.000Z");
    expect(isFlashcardDue("2026-06-08T12:00:00.000Z", now)).toBe(true);
    expect(isFlashcardDue("2026-06-08T11:59:59.999Z", now)).toBe(true);
    expect(isFlashcardDue("2026-06-08T12:00:00.001Z", now)).toBe(false);
  });
  describe("CI gate check — usuń po teście", () => {
    it("celowo pada", () => {
      expect(true).toBe(false);
    });
  });
});
