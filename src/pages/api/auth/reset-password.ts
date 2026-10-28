import type { APIRoute } from "astro";
import { toAuthErrorKey } from "@/lib/auth-errors";
import { RECOVERY_COOKIE, RESET_PASSWORD_PATH, resetPasswordOutcome } from "@/lib/password-recovery";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const password = field(form, "password");
  const confirmPassword = field(form, "confirmPassword");
  const supabase = context.locals.supabase;
  const hasRecoveryMarker = Boolean(context.cookies.get(RECOVERY_COOKIE)?.value);
  const input = {
    hasSession: Boolean(context.locals.user) && Boolean(supabase),
    hasRecoveryMarker,
    password,
    confirmPassword,
  };

  const ready = resetPasswordOutcome({ ...input, updateError: null });
  if (!supabase || !ready.signOut) {
    return context.redirect(ready.redirect);
  }

  const { error } = await supabase.auth.updateUser({ password });
  const outcome = resetPasswordOutcome({ ...input, updateError: error });

  if (outcome.signOut) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      return context.redirect(`${RESET_PASSWORD_PATH}?error=${toAuthErrorKey(signOutError)}`);
    }
    context.cookies.delete(RECOVERY_COOKIE, { path: "/" });
  }

  return context.redirect(outcome.redirect);
};
