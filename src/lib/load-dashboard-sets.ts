import { aggregateDueCountsBySetId } from "@/lib/aggregate-due-counts";
import type { MessageKey } from "@/lib/i18n";
import type { AppSupabaseClient } from "@/lib/supabase";
import type { DashboardSetRow, FlashcardSet } from "@/types";

export interface LoadDashboardSetsResult {
  sets: DashboardSetRow[];
  totalDue: number;
  /** MessageKey for load failure, or null. */
  error: MessageKey | null;
  /** MessageKey for non-fatal due-count warning, or null. */
  dueCountsWarning: MessageKey | null;
}

export async function loadDashboardSets(supabase: AppSupabaseClient | null): Promise<LoadDashboardSetsResult> {
  if (!supabase) {
    return { sets: [], totalDue: 0, error: "config.supabase.message", dueCountsWarning: null };
  }

  const { data, error } = await supabase
    .from("flashcard_sets")
    .select("id,name,created_at,updated_at,flashcards(count)")
    .order("updated_at", { ascending: false });

  if (error) {
    return { sets: [], totalDue: 0, error: "dashboard.error.load_sets", dueCountsWarning: null };
  }

  type SetWithCardCount = Pick<FlashcardSet, "id" | "name" | "created_at" | "updated_at"> & {
    flashcards: { count: number }[];
  };
  const rows = data as SetWithCardCount[];

  const mapSetsWithoutDue = (): DashboardSetRow[] =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      card_count: row.flashcards[0]?.count ?? 0,
      due_count: 0,
    }));

  const nowIso = new Date().toISOString();
  const { data: dueRows, error: dueError } = await supabase.from("flashcards").select("set_id").lte("due_at", nowIso);

  if (dueError) {
    return {
      sets: mapSetsWithoutDue(),
      totalDue: 0,
      error: null,
      dueCountsWarning: "dashboard.warning.due_counts",
    };
  }

  const { dueBySetId, totalDue: aggregatedTotalDue } = aggregateDueCountsBySetId(dueRows);

  const sets: DashboardSetRow[] = rows.map((row) => {
    const due_count = dueBySetId.get(row.id) ?? 0;
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      card_count: row.flashcards[0]?.count ?? 0,
      due_count,
    };
  });

  return { sets, totalDue: aggregatedTotalDue, error: null, dueCountsWarning: null };
}
