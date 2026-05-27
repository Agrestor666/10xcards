import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";
import type { AstroCookies } from "astro";
import { z } from "zod";

export interface SetDetailCard {
  id: string;
  question: string;
  answer: string;
  updated_at: string;
}

export type SetDetailLoadResult =
  | { kind: "redirect"; url: string }
  | {
      kind: "ok";
      set: { id: string; name: string };
      initialCards: SetDetailCard[];
      cardsLoadError: boolean;
    };

export async function loadSetDetailPage(
  rawId: string | undefined,
  headers: Headers,
  cookies: AstroCookies,
): Promise<SetDetailLoadResult> {
  if (!rawId || !z.uuid().safeParse(rawId).success) {
    return { kind: "redirect", url: `/dashboard?error=${encodeURIComponent("Invalid set")}` };
  }

  const supabase = createClient(headers, cookies);
  if (!supabase) {
    return {
      kind: "redirect",
      url: `/dashboard?error=${encodeURIComponent(SUPABASE_NOT_CONFIGURED_MESSAGE)}`,
    };
  }

  const { data: setRow, error: setError } = await supabase
    .from("flashcard_sets")
    .select("id,name")
    .eq("id", rawId)
    .maybeSingle();

  if (setError || !setRow) {
    return { kind: "redirect", url: `/dashboard?error=${encodeURIComponent("Set not found")}` };
  }

  const { data: cards, error: cardsError } = await supabase
    .from("flashcards")
    .select("id,question,answer,updated_at")
    .eq("set_id", rawId)
    .order("created_at", { ascending: true });

  return {
    kind: "ok",
    set: setRow,
    initialCards: cardsError ? [] : cards,
    cardsLoadError: Boolean(cardsError),
  };
}
