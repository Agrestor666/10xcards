import type { APIRoute } from "astro";
import { toAuthErrorKey } from "@/lib/auth-errors";
import { resolveLocale } from "@/lib/locale";
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
    return context.redirect("/auth/signup?error=captcha_failed");
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect("/auth/signup?error=supabase_unconfigured");
  }
  const locale = resolveLocale({
    user: context.locals.user,
    cookies: context.cookies,
    acceptLanguage: context.request.headers.get("Accept-Language"),
  });

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { locale },
    },
  });

  if (error) {
    return context.redirect(`/auth/signup?error=${toAuthErrorKey(error)}`);
  }

  return context.redirect("/auth/confirm-email");
};
