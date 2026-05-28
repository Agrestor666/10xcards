import { Rating } from "ts-fsrs";
import { toFsrsCard, toPersistedSchedule, type PersistedSrs } from "@/lib/srs/fsrs-mapper";
import { scheduler } from "@/lib/srs/scheduler";

export type GradeRating = "again" | "hard" | "good" | "easy";

function toFsrsRating(rating: GradeRating): Rating {
  switch (rating) {
    case "again":
      return Rating.Again;
    case "hard":
      return Rating.Hard;
    case "good":
      return Rating.Good;
    case "easy":
      return Rating.Easy;
  }
}

export function gradeCard(input: PersistedSrs, now: Date, rating: GradeRating): PersistedSrs {
  const card = toFsrsCard(input, now, { strict: true });
  const result = scheduler.next(card, now, toFsrsRating(rating));
  return toPersistedSchedule(result.card);
}
