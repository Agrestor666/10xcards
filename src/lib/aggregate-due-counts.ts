/** Shared due aggregation for dashboard SSR and due-summary API. */

export function aggregateDueCountsBySetId(rows: { set_id: string }[]): {
  dueBySetId: Map<string, number>;
  totalDue: number;
} {
  const dueBySetId = new Map<string, number>();
  for (const row of rows) {
    dueBySetId.set(row.set_id, (dueBySetId.get(row.set_id) ?? 0) + 1);
  }
  let totalDue = 0;
  for (const count of dueBySetId.values()) {
    totalDue += count;
  }
  return { dueBySetId, totalDue };
}
