import type { APIRoute } from "astro";
import { flashcardSetCreateErrorMessage, SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/flashcard-set-errors";
import { validateFlashcardSetName } from "@/lib/flashcard-set-name";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function dashboardErrorRedirect(context: Parameters<APIRoute>[0], message: string) {
  return context.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const validation = validateFlashcardSetName(form.get("name"));

  if (!validation.ok) {
    return dashboardErrorRedirect(context, validation.error);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return dashboardErrorRedirect(context, SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return context.redirect("/auth/signin");
  }

  // Ownership comes only from the authenticated session — never from form fields.
  const { error } = await supabase.from("flashcard_sets").insert({
    user_id: user.id,
    name: validation.name,
  });

  if (error) {
    return dashboardErrorRedirect(context, flashcardSetCreateErrorMessage(error));
  }

  return context.redirect("/dashboard");
};
