import type { APIRoute } from "astro";
import { CHECK_EMAIL_PATH, forgotPasswordRedirectTarget, recoverRedirectTo } from "@/lib/password-recovery";
import { extractTurnstileToken, resolveClientIp, verifyTurnstileToken } from "@/lib/turnstile";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const rawEmail = form.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  const precheck = forgotPasswordRedirectTarget(email, null);
  if (precheck !== CHECK_EMAIL_PATH) {
    return context.redirect(precheck);
  }

  const captchaOk = await verifyTurnstileToken({
    token: extractTurnstileToken(form),
    remoteIp: resolveClientIp(context.request.headers),
  });
  if (!captchaOk) {
    return context.redirect("/auth/forgot-password?error=captcha_failed");
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect("/auth/forgot-password?error=supabase_unconfigured");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: recoverRedirectTo(context.url.origin),
  });

  return context.redirect(forgotPasswordRedirectTarget(email, error));
};
