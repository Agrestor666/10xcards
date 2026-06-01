import { t, type MessageKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

export type AuthErrorKey =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "rate_limit"
  | "supabase_unconfigured"
  | "generic";

const AUTH_ERROR_KEYS = new Set<string>([
  "invalid_credentials",
  "email_taken",
  "weak_password",
  "rate_limit",
  "supabase_unconfigured",
  "generic",
]);

const AUTH_ERROR_MESSAGE_KEYS: Record<AuthErrorKey, MessageKey> = {
  invalid_credentials: "auth.error.invalid_credentials",
  email_taken: "auth.error.email_taken",
  weak_password: "auth.error.weak_password",
  rate_limit: "auth.error.rate_limit",
  supabase_unconfigured: "auth.error.supabase_unconfigured",
  generic: "auth.error.generic",
};

export function isAuthErrorKey(value: string): value is AuthErrorKey {
  return AUTH_ERROR_KEYS.has(value);
}

export function toAuthErrorKey(error: { message?: string; code?: string }): AuthErrorKey {
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "invalid_credentials";
  }

  if (
    code === "user_already_exists" ||
    message.includes("user already registered") ||
    message.includes("already been registered") ||
    message.includes("email address is already registered")
  ) {
    return "email_taken";
  }

  if (
    code === "weak_password" ||
    message.includes("password should be at least") ||
    message.includes("password is too weak")
  ) {
    return "weak_password";
  }

  if (
    code === "over_request_rate_limit" ||
    code === "too_many_requests" ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("email rate limit")
  ) {
    return "rate_limit";
  }

  return "generic";
}

export function authErrorMessage(locale: AppLocale, key: AuthErrorKey): string {
  return t(locale, AUTH_ERROR_MESSAGE_KEYS[key]);
}

export function resolveAuthErrorMessage(locale: AppLocale, errorParam: string | null): string | null {
  if (!errorParam) {
    return null;
  }

  if (isAuthErrorKey(errorParam)) {
    return authErrorMessage(locale, errorParam);
  }

  return authErrorMessage(locale, "generic");
}
