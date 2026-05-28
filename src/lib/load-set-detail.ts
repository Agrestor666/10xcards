import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";
import type { AstroCookies } from "astro";
import { z } from "zod";

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

async function fetchSetMeta(rawId: string, headers: Headers, cookies: AstroCookies): Promise<SetMetaLoadResult> {
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

  const parsed = setMetaSchema.safeParse(setRow);
  if (setError || !parsed.success) {
    return { kind: "redirect", url: `/dashboard?error=${encodeURIComponent("Set not found")}` };
  }

  return { kind: "ok", set: parsed.data };
}

export async function loadSetMetaPage(
  rawId: string | undefined,
  headers: Headers,
  cookies: AstroCookies,
): Promise<SetMetaLoadResult> {
  if (!rawId || !z.uuid().safeParse(rawId).success) {
    return { kind: "redirect", url: `/dashboard?error=${encodeURIComponent("Invalid set")}` };
  }

  return fetchSetMeta(rawId, headers, cookies);
}

export async function loadSetDetailPage(
  rawId: string | undefined,
  headers: Headers,
  cookies: AstroCookies,
): Promise<SetDetailLoadResult> {
  if (!rawId || !z.uuid().safeParse(rawId).success) {
    return { kind: "redirect", url: `/dashboard?error=${encodeURIComponent("Invalid set")}` };
  }

  const metaResult = await fetchSetMeta(rawId, headers, cookies);
  if (metaResult.kind === "redirect") {
    return metaResult;
  }

  const supabase = createClient(headers, cookies);
  if (!supabase) {
    return {
      kind: "redirect",
      url: `/dashboard?error=${encodeURIComponent(SUPABASE_NOT_CONFIGURED_MESSAGE)}`,
    };
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
