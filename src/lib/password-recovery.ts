import { PASSWORD_UPDATED_NOTICE, toAuthErrorKey } from "@/lib/auth-errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const CHECK_EMAIL_PATH = "/auth/check-email";
export const RESET_PASSWORD_PATH = "/auth/reset-password";
export const SIGN_IN_PATH = "/auth/signin";
export const RECOVERY_COOKIE = "pw-recovery";
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 3600;
export const MIN_PASSWORD_LENGTH = 6;

export function recoverRedirectTo(origin: string): string {
  return `${origin}/auth/recover`;
}

export interface ResetPasswordOutcome {
  redirect: string;
  signOut: boolean;
}

export function resetPasswordOutcome(input: {
  hasSession: boolean;
  hasRecoveryMarker: boolean;
  password: string;
  confirmPassword: string;
  updateError: { message?: string; code?: string } | null;
}): ResetPasswordOutcome {
  if (!input.hasSession || !input.hasRecoveryMarker) {
    return { redirect: `${RESET_PASSWORD_PATH}?error=link_invalid`, signOut: false };
  }

  if (input.password.length < MIN_PASSWORD_LENGTH || input.password !== input.confirmPassword) {
    return { redirect: `${RESET_PASSWORD_PATH}?error=weak_password`, signOut: false };
  }

  if (input.updateError) {
    return {
      redirect: `${RESET_PASSWORD_PATH}?error=${toAuthErrorKey(input.updateError)}`,
      signOut: false,
    };
  }

  return { redirect: `${SIGN_IN_PATH}?notice=${PASSWORD_UPDATED_NOTICE}`, signOut: true };
}

export function forgotPasswordRedirectTarget(email: string, error: { message?: string; code?: string } | null): string {
  const trimmed = email.trim();
  if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
    return `${FORGOT_PASSWORD_PATH}?error=email_invalid`;
  }

  if (!error) {
    return CHECK_EMAIL_PATH;
  }

  return `${FORGOT_PASSWORD_PATH}?error=${toAuthErrorKey(error)}`;
}
