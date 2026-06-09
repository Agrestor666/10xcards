import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { toFsrsCard, toPersistedSchedule, type PersistedSrs } from "@/lib/srs/fsrs-mapper";

const NOW = new Date("2026-06-08T12:00:00.000Z");

const ISO_WITH_TZ = /([zZ]|[+-]\d{2}:\d{2})$/;

describe("toFsrsCard", () => {
  it("maps empty srs_state to FSRS defaults", () => {
    const input: PersistedSrs = { due_at: NOW.toISOString(), srs_state: {} };
    const card = toFsrsCard(input, NOW);

    expect(card.due.toISOString()).toBe(NOW.toISOString());
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(Number.isFinite(card.stability)).toBe(true);
    expect(Number.isFinite(card.difficulty)).toBe(true);
  });

  it("roundtrips v1 srs_state through toPersistedSchedule", () => {
    const input: PersistedSrs = {
      due_at: NOW.toISOString(),
      srs_state: {
        v: 1,
        stability: 2.5,
        difficulty: 6.2,
        scheduled_days: 3,
        learning_steps: 1,
        reps: 4,
        lapses: 1,
        state: State.Review,
        last_review: "2026-06-07T12:00:00.000Z",
      },
    };

    const card = toFsrsCard(input, NOW);
    const persisted = toPersistedSchedule(card);

    expect(persisted.srs_state.v).toBe(1);
    expect(persisted.srs_state.stability).toBe(2.5);
    expect(persisted.srs_state.difficulty).toBe(6.2);
    expect(persisted.srs_state.reps).toBe(4);
    expect(persisted.srs_state.state).toBe(State.Review);
    expect(persisted.due_at).toBe(NOW.toISOString());
    expect(persisted.srs_state.last_review).toBe("2026-06-07T12:00:00.000Z");
    expect(ISO_WITH_TZ.test(persisted.due_at)).toBe(true);
  });

  it("throws in strict mode for due_at without timezone", () => {
    const input: PersistedSrs = { due_at: "2026-06-08T12:00:00", srs_state: {} };
    expect(() => toFsrsCard(input, NOW, { strict: true })).toThrow(/due_at must be a valid ISO timestamp/);
  });

  it("throws in strict mode for malformed v1 numeric fields", () => {
    const input: PersistedSrs = {
      due_at: NOW.toISOString(),
      srs_state: { v: 1, stability: "bad" },
    };
    expect(() => toFsrsCard(input, NOW, { strict: true })).toThrow(/srs_state\.stability/);
  });
});

describe("toPersistedSchedule", () => {
  it("always writes srs_state.v === 1", () => {
    const input: PersistedSrs = { due_at: NOW.toISOString(), srs_state: {} };
    const persisted = toPersistedSchedule(toFsrsCard(input, NOW));

    expect(persisted.srs_state.v).toBe(1);
    expect(ISO_WITH_TZ.test(persisted.due_at)).toBe(true);
  });
});
