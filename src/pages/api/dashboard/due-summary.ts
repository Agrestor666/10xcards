import type { APIRoute } from "astro";
import { aggregateDueCountsBySetId } from "@/lib/aggregate-due-counts";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";
import { dueAsOfIso } from "@/lib/srs/is-due";

export const prerender = false;

type DueSummaryResponse =
  | { ok: true; totalDue: number; dueBySetId: Record<string, number> }
  | { ok: false; message: string };

function jsonResponse(body: DueSummaryResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async (context) => {
  const locale = getLocaleFromContext(context);
  const supabase = context.locals.supabase;
  if (!supabase) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.service_unavailable") }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.unauthorized") }, 401);
  }

  const now = new Date();
  const { data: dueRows, error: dueError } = await supabase
    .from("flashcards")
    .select("set_id")
    .lte("due_at", dueAsOfIso(now));

  if (dueError) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.load_due_counts") }, 500);
  }

  const { dueBySetId, totalDue } = aggregateDueCountsBySetId(dueRows);
  const dueBySetIdRecord: Record<string, number> = {};
  for (const [setId, count] of dueBySetId) {
    dueBySetIdRecord[setId] = count;
  }

  return jsonResponse({ ok: true, totalDue, dueBySetId: dueBySetIdRecord }, 200);
};
