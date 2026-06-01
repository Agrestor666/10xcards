import type { FlashcardSetErrorKey } from "@/lib/flashcard-set-errors";
import type { AppSupabaseClient } from "@/lib/supabase";
import { z } from "zod";

function dashboardErrorUrl(errorKey: FlashcardSetErrorKey): string {
  return `/dashboard?error=${encodeURIComponent(errorKey)}`;
}

export interface SetMeta {
  id: string;
  name: string;
}

export interface SetDetailCard {
  id: string;
  question: string;
  answer: string;
  updated_at: string;
}

export type SetMetaLoadResult = { kind: "redirect"; url: string } | { kind: "ok"; set: SetMeta };

export type SetDetailLoadResult =
  | { kind: "redirect"; url: string }
  | {
      kind: "ok";
      set: SetMeta;
      initialCards: SetDetailCard[];
      cardsLoadError: boolean;
    };

const setMetaSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

async function fetchSetMeta(supabase: AppSupabaseClient | null, rawId: string): Promise<SetMetaLoadResult> {
  if (!supabase) {
    return { kind: "redirect", url: dashboardErrorUrl("supabase_unconfigured") };
  }

  const { data: setRow, error: setError } = await supabase
    .from("flashcard_sets")
    .select("id,name")
    .eq("id", rawId)
    .maybeSingle();

  const parsed = setMetaSchema.safeParse(setRow);
  if (setError || !parsed.success) {
    return { kind: "redirect", url: dashboardErrorUrl("set_not_found") };
  }

  return { kind: "ok", set: parsed.data };
}

export async function loadSetMetaPage(
  rawId: string | undefined,
  supabase: AppSupabaseClient | null,
): Promise<SetMetaLoadResult> {
  if (!rawId || !z.uuid().safeParse(rawId).success) {
    return { kind: "redirect", url: dashboardErrorUrl("set_invalid") };
  }

  return fetchSetMeta(supabase, rawId);
}

export async function loadSetDetailPage(
  rawId: string | undefined,
  supabase: AppSupabaseClient | null,
): Promise<SetDetailLoadResult> {
  if (!rawId || !z.uuid().safeParse(rawId).success) {
    return { kind: "redirect", url: dashboardErrorUrl("set_invalid") };
  }

  const metaResult = await fetchSetMeta(supabase, rawId);
  if (metaResult.kind === "redirect") {
    return metaResult;
  }

  if (!supabase) {
    return { kind: "redirect", url: dashboardErrorUrl("supabase_unconfigured") };
  }

  const { data: cards, error: cardsError } = await supabase
    .from("flashcards")
    .select("id,question,answer,updated_at")
    .eq("set_id", rawId)
    .order("created_at", { ascending: true });

  return {
    kind: "ok",
    set: metaResult.set,
    initialCards: cardsError ? [] : cards,
    cardsLoadError: Boolean(cardsError),
  };
}
