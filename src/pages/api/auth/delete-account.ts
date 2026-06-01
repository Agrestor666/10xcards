import type { APIRoute } from "astro";
import { z } from "zod";
import { accountDeleteErrorMessage, supabaseAdminNotConfiguredMessage } from "@/lib/account-errors";
import { jsonResponse } from "@/lib/api-json";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";
import { createAdminClient } from "@/lib/supabase-admin";

export const prerender = false;

const deleteAccountBodySchema = z.object({
  confirm: z.literal("DELETE"),
});

export const POST: APIRoute = async (context) => {
  const locale = getLocaleFromContext(context);
  const supabase = context.locals.supabase;
  if (!supabase) {
    return jsonResponse({ ok: false, message: supabaseNotConfiguredMessage(locale) }, 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.sign_in_delete_account") }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const parsed = deleteAccountBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonResponse({ ok: false, message: supabaseAdminNotConfiguredMessage(locale) }, 503);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    // eslint-disable-next-line no-console -- delete failure must be observable in wrangler logs
    console.error("delete-account: auth.admin.deleteUser failed", deleteError);
    return jsonResponse({ ok: false, message: accountDeleteErrorMessage(locale, deleteError) }, 403);
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    // eslint-disable-next-line no-console -- user deleted; cookie cleanup failure should be observable
    console.error("delete-account: signOut after deleteUser failed", signOutError);
  }

  return jsonResponse({ ok: true });
};
