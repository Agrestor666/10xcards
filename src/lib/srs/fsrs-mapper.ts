import { createEmptyCard, State, type Card } from "ts-fsrs";

export interface PersistedSrs {
  due_at: string;
  srs_state: Record<string, unknown>;
}

interface SrsStateV1 {
  v: 1;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
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
    // Only accept timestamps with explicit timezone info (Z / ±hh:mm).
    // This avoids Date's environment-dependent parsing for timezone-less strings.
    const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
    if (!hasTimezone) return undefined;

    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}

function asSrsStateV1(value: unknown): SrsStateV1 | undefined {
  if (!isRecord(value)) return undefined;
  if (value.v !== 1) return undefined;

  const last_review = value.last_review;
  if (!(typeof last_review === "string" || last_review === null || last_review === undefined)) {
    return undefined;
  }

  return {
    v: 1,
    stability: asNumber(value.stability) ?? NaN,
    difficulty: asNumber(value.difficulty) ?? NaN,
    scheduled_days: asNumber(value.scheduled_days) ?? NaN,
    learning_steps: asNumber(value.learning_steps) ?? NaN,
    reps: asNumber(value.reps) ?? NaN,
    lapses: asNumber(value.lapses) ?? NaN,
    state: typeof value.state === "number" ? value.state : NaN,
    last_review: last_review ?? null,
  };
}

function validatePersistedSrs(input: PersistedSrs): string[] {
  const issues: string[] = [];

  if (typeof input.due_at !== "string") {
    issues.push("due_at must be a string");
  } else if (!asDate(input.due_at)) {
    issues.push("due_at must be a valid ISO timestamp with timezone (Z or ±hh:mm)");
  }

  if (!isRecord(input.srs_state)) {
    issues.push("srs_state must be an object");
    return issues;
  }

  // Accept either legacy (no v) or v1.
  if ("v" in input.srs_state && input.srs_state.v !== 1) {
    issues.push("srs_state.v must be 1 when present");
  }

  const stateObj = input.srs_state;
  const numericKeys = [
    "stability",
    "difficulty",
    "scheduled_days",
    "learning_steps",
    "reps",
    "lapses",
    "state",
  ] as const;

  for (const key of numericKeys) {
    const v = stateObj[key];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) {
      issues.push(`srs_state.${key} must be a finite number when present`);
    }
  }

  const lr = stateObj.last_review;
  if (lr !== undefined && lr !== null && (typeof lr !== "string" || !asDate(lr))) {
    issues.push("srs_state.last_review must be null or an ISO timestamp with timezone when present");
  }

  return issues;
}

export function toFsrsCard(input: PersistedSrs, now: Date, options?: { strict?: boolean }): Card {
  if (options?.strict) {
    const issues = validatePersistedSrs(input);
    if (issues.length > 0) {
      throw new Error(`Invalid persisted SRS payload: ${issues.join("; ")}`);
    }
  }

  const base = createEmptyCard(now);
  const v1 = asSrsStateV1(input.srs_state);
  const state = v1 ?? (isRecord(input.srs_state) ? input.srs_state : {});

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
    v: 1,
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
