import type { APIRoute } from "astro";
import { z } from "zod";
import { accountDeleteErrorMessage, SUPABASE_ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/account-errors";
import { jsonResponse } from "@/lib/api-json";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const deleteAccountBodySchema = z.object({
  confirm: z.literal("DELETE"),
});

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ ok: false, message: SUPABASE_NOT_CONFIGURED_MESSAGE }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: "Please sign in to delete your account." }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = deleteAccountBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400);
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonResponse({ ok: false, message: SUPABASE_ADMIN_NOT_CONFIGURED_MESSAGE }, 503);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    // eslint-disable-next-line no-console -- delete failure must be observable in wrangler logs
    console.error("delete-account: auth.admin.deleteUser failed", deleteError);
    return jsonResponse({ ok: false, message: accountDeleteErrorMessage(deleteError) }, 403);
  }

  await supabase.auth.signOut();

  return jsonResponse({ ok: true });
};
