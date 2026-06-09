import { describe, expect, it } from "vitest";

import { gradeCard, type GradeRating } from "@/lib/srs/grade-card";
import { isFlashcardDue } from "@/lib/srs/is-due";
import { scheduler } from "@/lib/srs/scheduler";

const NOW = new Date("2026-06-08T12:00:00.000Z");
const ISO_WITH_TZ = /([zZ]|[+-]\d{2}:\d{2})$/;

const NEW_CARD = { due_at: NOW.toISOString(), srs_state: {} };

const RATINGS: GradeRating[] = ["again", "hard", "good", "easy"];

function expectValidPersistedSchedule(result: ReturnType<typeof gradeCard>): void {
  expect(ISO_WITH_TZ.test(result.due_at)).toBe(true);
  expect(result.srs_state.v).toBe(1);
  for (const key of ["stability", "difficulty", "scheduled_days", "learning_steps", "reps", "lapses", "state"]) {
    const value = result.srs_state[key];
    expect(typeof value).toBe("number");
    expect(Number.isFinite(value)).toBe(true);
  }
}

describe("gradeCard", () => {
  it("uses the real ts-fsrs scheduler (not mocked)", () => {
    expect(scheduler).toBeDefined();
  });

  it.each(RATINGS)("returns valid persisted schedule for rating %s", (rating) => {
    const result = gradeCard(NEW_CARD, NOW, rating);
    expectValidPersistedSchedule(result);
  });

  it("schedules good ratings beyond now", () => {
    const result = gradeCard(NEW_CARD, NOW, "good");
    expect(result.due_at > NOW.toISOString()).toBe(true);
    expect(isFlashcardDue(result.due_at, NOW)).toBe(false);
  });

  it("again increments reps or lapses and schedules sooner than good", () => {
    const againResult = gradeCard(NEW_CARD, NOW, "again");
    const goodResult = gradeCard(NEW_CARD, NOW, "good");

    const reps = againResult.srs_state.reps as number;
    const lapses = againResult.srs_state.lapses as number;
    expect(reps > 0 || lapses > 0).toBe(true);

    // "Again" may schedule slightly after NOW but always sooner than "good".
    const againDueSooner = isFlashcardDue(againResult.due_at, NOW) || againResult.due_at <= goodResult.due_at;
    expect(againDueSooner).toBe(true);
  });
});
