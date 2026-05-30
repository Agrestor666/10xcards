import type { AstroCookies } from "astro";
import { aggregateDueCountsBySetId } from "@/lib/aggregate-due-counts";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";
import type { DashboardSetRow, FlashcardSet } from "@/types";

export interface LoadDashboardSetsResult {
  sets: DashboardSetRow[];
  totalDue: number;
  error: string | null;
  /** Non-fatal: sets loaded but due aggregation failed. */
  dueCountsWarning: string | null;
}

export async function loadDashboardSets(
  requestHeaders: Headers,
  cookies: AstroCookies,
): Promise<LoadDashboardSetsResult> {
  const supabase = createClient(requestHeaders, cookies);
  if (!supabase) {
    return { sets: [], totalDue: 0, error: SUPABASE_NOT_CONFIGURED_MESSAGE, dueCountsWarning: null };
  }

  const { data, error } = await supabase
    .from("flashcard_sets")
    .select("id,name,created_at,updated_at,flashcards(count)")
    .order("updated_at", { ascending: false });

  if (error) {
    return { sets: [], totalDue: 0, error: "Could not load your sets. Please refresh.", dueCountsWarning: null };
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
      dueCountsWarning: "Due counts are temporarily unavailable. Your sets are shown below; refresh to retry.",
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
