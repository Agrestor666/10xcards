import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonResponse } from "@/lib/api-json";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

interface DueCard {
  id: string;
  question: string;
  answer: string;
}

interface NextDueRow {
  due_at: string | null;
}

const dueCardSchema: z.ZodType<DueCard> = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
});

const nextDueSchema: z.ZodType<NextDueRow> = z.object({
  due_at: z.string().nullable(),
});

const querySchema = z.object({
  setId: z.uuid(),
});

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ ok: false, message: SUPABASE_NOT_CONFIGURED_MESSAGE }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: "Please sign in to continue." }, 401);
  }

  const url = new URL(context.request.url);
  const rawSetId = url.searchParams.get("setId");
  const parsedQuery = querySchema.safeParse({ setId: rawSetId });
  if (!parsedQuery.success) {
    return jsonResponse({ ok: false, message: "Invalid request." }, 400);
  }

  const nowIso = new Date().toISOString();

  const dueResult = await supabase
    .from("flashcards")
    .select("id, question, answer")
    .eq("set_id", parsedQuery.data.setId)
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (dueResult.error) {
    return jsonResponse({ ok: false, message: dueResult.error.message }, 403);
  }

  const dueCardParse = dueCardSchema.nullable().safeParse(dueResult.data);
  if (!dueCardParse.success) {
    return jsonResponse({ ok: false, message: "Invalid response." }, 500);
  }

  const dueCard = dueCardParse.data;
  if (dueCard) {
    return jsonResponse({ ok: true, kind: "due", card: dueCard });
  }

  const nextResult = await supabase
    .from("flashcards")
    .select("due_at")
    .eq("set_id", parsedQuery.data.setId)
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextResult.error) {
    return jsonResponse({ ok: false, message: nextResult.error.message }, 403);
  }

  const nextCardParse = nextDueSchema.nullable().safeParse(nextResult.data);
  if (!nextCardParse.success) {
    return jsonResponse({ ok: false, message: "Invalid response." }, 500);
  }

  const nextCard = nextCardParse.data;
  return jsonResponse({
    ok: true,
    kind: "empty",
    nextDueAt: nextCard?.due_at ?? null,
  });
};
