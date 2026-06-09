/** ISO timestamp for Supabase `.lte("due_at", …)` queries — matches `now.toISOString()`. */
export function dueAsOfIso(now: Date): string {
  return now.toISOString();
}

/** Whether a card is due as of `now` (same semantics as `due_at <= nowIso` in production queries). */
export function isFlashcardDue(dueAt: string, now: Date): boolean {
  return dueAt <= dueAsOfIso(now);
}
