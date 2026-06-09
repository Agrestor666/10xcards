import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { gradeCard } from "@/lib/srs/grade-card";
import { type PersistedSrs } from "@/lib/srs/fsrs-mapper";
import { isFlashcardDue } from "@/lib/srs/is-due";

const NOW = new Date("2026-06-08T12:00:00.000Z");

interface QueueCard {
  id: string;
  due_at: string;
  srs_state: PersistedSrs["srs_state"];
}

function dueQueue(cards: QueueCard[], now: Date): QueueCard[] {
  return cards.filter((c) => isFlashcardDue(c.due_at, now)).sort((a, b) => a.due_at.localeCompare(b.due_at));
}

describe("grade → due flow (Risk #1: grade updates schedule; due query returns card when due)", () => {
  describe("Scenario A — grade removes card from due queue", () => {
    it("good rating schedules beyond now so isFlashcardDue is false", () => {
      const input: PersistedSrs = { due_at: NOW.toISOString(), srs_state: {} };
      const graded = gradeCard(input, NOW, "good");

      expect(isFlashcardDue(graded.due_at, NOW)).toBe(false);
    });
  });

  describe("Scenario B — ungraded due card stays in due queue", () => {
    it("card with due_at equal to now is due", () => {
      const dueAt = NOW.toISOString();
      expect(isFlashcardDue(dueAt, NOW)).toBe(true);
    });
  });

  describe("Scenario C — due queue selection after grade", () => {
    it("grades earliest due card and returns the next due card", () => {
      const cards: QueueCard[] = [
        { id: "a", due_at: "2026-06-08T11:00:00.000Z", srs_state: {} },
        { id: "b", due_at: NOW.toISOString(), srs_state: {} },
        { id: "c", due_at: "2026-06-09T12:00:00.000Z", srs_state: {} },
      ];

      const queue = dueQueue(cards, NOW);
      expect(queue.map((c) => c.id)).toEqual(["a", "b"]);

      const earliest = queue[0];
      const graded = gradeCard({ due_at: earliest.due_at, srs_state: earliest.srs_state }, NOW, "good");

      const remaining = dueQueue(
        cards.map((c) => (c.id === earliest.id ? { ...c, due_at: graded.due_at, srs_state: graded.srs_state } : c)),
        NOW,
      );

      expect(remaining.map((c) => c.id)).not.toContain("a");
      expect(remaining[0]?.id).toBe("b");
    });
  });

  describe("Scenario D — v1 state survives grade cycle", () => {
    it("grades a review card and due outcome matches schedule", () => {
      const input: PersistedSrs = {
        due_at: NOW.toISOString(),
        srs_state: {
          v: 1,
          stability: 4.2,
          difficulty: 5.8,
          scheduled_days: 7,
          learning_steps: 0,
          reps: 6,
          lapses: 0,
          state: State.Review,
          last_review: "2026-06-01T12:00:00.000Z",
        },
      };

      const graded = gradeCard(input, NOW, "good");

      expect(graded.srs_state.v).toBe(1);
      expect(typeof graded.srs_state.stability).toBe("number");
      expect(typeof graded.srs_state.reps).toBe("number");
      expect(Number.isFinite(graded.srs_state.stability as number)).toBe(true);
      expect(isFlashcardDue(input.due_at, NOW)).toBe(true);
      expect(isFlashcardDue(graded.due_at, NOW)).toBe(false);
    });
  });
});
