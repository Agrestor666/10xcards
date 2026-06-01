import type { APIRoute } from "astro";
import { toAuthErrorKey } from "@/lib/auth-errors";
import { getLocaleFromCookies } from "@/lib/locale";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect("/auth/signin?error=supabase_unconfigured");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${toAuthErrorKey(error)}`);
  }

  const cookieLocale = getLocaleFromCookies(context.cookies);
  const metaLocale: unknown = data.user.user_metadata.locale;
  if (cookieLocale && cookieLocale !== metaLocale) {
    try {
      await supabase.auth.updateUser({ data: { locale: cookieLocale } });
    } catch {
      // best-effort locale sync — do not block sign-in on failure
    }
  }

  return context.redirect("/dashboard");
};
