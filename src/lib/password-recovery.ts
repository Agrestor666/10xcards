import { toAuthErrorKey } from "@/lib/auth-errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const CHECK_EMAIL_PATH = "/auth/check-email";

export function recoverRedirectTo(origin: string): string {
  return `${origin}/auth/recover`;
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
