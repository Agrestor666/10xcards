import type { APIRoute } from "astro";
import { toAuthErrorKey } from "@/lib/auth-errors";
import { getLocaleFromCookies } from "@/lib/locale";
import { extractTurnstileToken, resolveClientIp, verifyTurnstileToken } from "@/lib/turnstile";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const captchaOk = await verifyTurnstileToken({
    token: extractTurnstileToken(form),
    remoteIp: resolveClientIp(context.request.headers),
  });
  if (!captchaOk) {
    return context.redirect("/auth/signin?error=captcha_failed");
  }

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
