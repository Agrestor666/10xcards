import type { APIRoute } from "astro";
import { jsonResponse } from "@/lib/api-json";
import {
  flashcardSetCreateErrorMessage,
  flashcardSetErrorMessage,
  supabaseNotConfiguredMessage,
  toFlashcardSetCreateErrorKey,
  type FlashcardSetErrorKey,
} from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import { getLocaleFromContext } from "@/lib/locale";
import { validateFlashcardSetName } from "@/lib/flashcard-set-name";

export const prerender = false;

function wantsJsonResponse(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";
  return accept.includes("application/json");
}

function dashboardErrorRedirect(context: Parameters<APIRoute>[0], errorKey: FlashcardSetErrorKey) {
  return context.redirect(`/dashboard?error=${encodeURIComponent(errorKey)}`);
}

export const POST: APIRoute = async (context) => {
  const locale = getLocaleFromContext(context);
  const asJson = wantsJsonResponse(context.request);
  const form = await context.request.formData();
  const validation = validateFlashcardSetName(form.get("name"));

  if (!validation.ok) {
    const errorKey = validation.key;
    if (asJson) {
      return jsonResponse({ ok: false, message: flashcardSetErrorMessage(locale, errorKey) }, 400);
    }
    return dashboardErrorRedirect(context, errorKey);
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    const errorKey = "supabase_unconfigured" satisfies FlashcardSetErrorKey;
    if (asJson) {
      return jsonResponse({ ok: false, message: supabaseNotConfiguredMessage(locale) }, 503);
    }
    return dashboardErrorRedirect(context, errorKey);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (asJson) {
      return jsonResponse({ ok: false, message: t(locale, "api.error.unauthorized") }, 401);
    }
    return context.redirect("/auth/signin");
  }

  const { error } = await supabase.from("flashcard_sets").insert({
    user_id: user.id,
    name: validation.name,
  });

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- dev-only insert diagnostics
      console.error("flashcard_sets insert failed:", error);
    }
    const errorKey = toFlashcardSetCreateErrorKey(error);
    if (asJson) {
      return jsonResponse({ ok: false, message: flashcardSetCreateErrorMessage(locale, error) }, 400);
    }
    return dashboardErrorRedirect(context, errorKey);
  }

  if (asJson) {
    return jsonResponse({ ok: true }, 201);
  }

  return context.redirect("/dashboard");
};
