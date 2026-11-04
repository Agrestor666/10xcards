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

function isJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("Content-Type") ?? "";
  return contentType.includes("application/json");
}

async function readCreateSetName(
  request: Request,
): Promise<{ ok: true; rawName: FormDataEntryValue | null } | { ok: false }> {
  if (isJsonContentType(request)) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { ok: false };
    }

    if (typeof body === "object" && body !== null && "name" in body) {
      const name = body.name;
      return { ok: true, rawName: typeof name === "string" ? name : null };
    }

    return { ok: true, rawName: null };
  }

  const form = await request.formData();
  return { ok: true, rawName: form.get("name") };
}

export const POST: APIRoute = async (context) => {
  const locale = getLocaleFromContext(context);
  const asJson = wantsJsonResponse(context.request);
  const nameRead = await readCreateSetName(context.request);
  if (!nameRead.ok) {
    return jsonResponse({ ok: false, message: t(locale, "api.error.invalid_body") }, 400);
  }

  const validation = validateFlashcardSetName(nameRead.rawName);

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

  const { data, error } = await supabase
    .from("flashcard_sets")
    .insert({
      user_id: user.id,
      name: validation.name,
    })
    .select("id, name, created_at, updated_at")
    .single();

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
    return jsonResponse({ ok: true, set: data }, 201);
  }

  return context.redirect("/dashboard");
};
