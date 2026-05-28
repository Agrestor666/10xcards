import { createEmptyCard, State, type Card } from "ts-fsrs";

export interface PersistedSrs {
  due_at: string;
  srs_state: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asState(value: unknown): State | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  switch (value) {
    case 0:
      return State.New;
    case 1:
      return State.Learning;
    case 2:
      return State.Review;
    case 3:
      return State.Relearning;
    default:
      return undefined;
  }
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;

  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}

export function toFsrsCard(input: PersistedSrs, now: Date): Card {
  const base = createEmptyCard(now);
  const state = isRecord(input.srs_state) ? input.srs_state : {};

  const due = asDate(input.due_at) ?? now;
  const lastReview = asDate(state.last_review);

  return {
    ...base,
    due,
    stability: asNumber(state.stability) ?? base.stability,
    difficulty: asNumber(state.difficulty) ?? base.difficulty,
    scheduled_days: asNumber(state.scheduled_days) ?? base.scheduled_days,
    learning_steps: asNumber(state.learning_steps) ?? base.learning_steps,
    reps: asNumber(state.reps) ?? base.reps,
    lapses: asNumber(state.lapses) ?? base.lapses,
    state: asState(state.state) ?? base.state,
    last_review: lastReview ?? base.last_review,
  };
}

export function toPersistedSchedule(card: Card): PersistedSrs {
  const due_at = card.due.toISOString();
  const srs_state: Record<string, unknown> = {
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };

  return { due_at, srs_state };
}
