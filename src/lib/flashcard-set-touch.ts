import type { SupabaseClient } from "@supabase/supabase-js";

/** Bump parent set ordering timestamp after card mutations (no DB trigger in F-01). */
export async function touchFlashcardSetUpdatedAt(supabase: SupabaseClient, setId: string): Promise<void> {
  const { error } = await supabase
    .from("flashcard_sets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", setId);

  if (error) {
    // Server-side only; no client logger in Workers MVP
    // eslint-disable-next-line no-console -- touch failure must be observable in wrangler logs
    console.error("[touchFlashcardSetUpdatedAt] failed", { setId, code: error.code });
  }
}
