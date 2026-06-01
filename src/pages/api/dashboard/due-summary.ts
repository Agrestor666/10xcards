import type { APIRoute } from "astro";
import { aggregateDueCountsBySetId } from "@/lib/aggregate-due-counts";

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

export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase;
  if (!supabase) {
    return jsonResponse({ ok: false, message: "Service unavailable." }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: "Unauthorized." }, 401);
  }

  const nowIso = new Date().toISOString();
  const { data: dueRows, error: dueError } = await supabase.from("flashcards").select("set_id").lte("due_at", nowIso);

  if (dueError) {
    return jsonResponse({ ok: false, message: "Could not load due counts." }, 500);
  }

  const { dueBySetId, totalDue } = aggregateDueCountsBySetId(dueRows);
  const dueBySetIdRecord: Record<string, number> = {};
  for (const [setId, count] of dueBySetId) {
    dueBySetIdRecord[setId] = count;
  }

  return jsonResponse({ ok: true, totalDue, dueBySetId: dueBySetIdRecord }, 200);
};
