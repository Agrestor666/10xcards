import type { APIRoute } from "astro";
import { jsonResponse } from "@/lib/api-json";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createClient } from "@/lib/supabase";
import { scheduler } from "@/lib/srs/scheduler";
import { createEmptyCard, Rating } from "ts-fsrs";

export const prerender = false;

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

  try {
    const now = new Date();
    scheduler.next(createEmptyCard(now), now, Rating.Good);
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ ok: false, message }, 500);
  }
};
