import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

export function supabaseAdminNotConfiguredMessage(locale: AppLocale): string {
  return t(locale, "account.error.admin_not_configured");
}

/**
 * Maps delete-account failures to user-safe strings.
 * Log the raw error server-side; never forward internal details to the client.
 */
export function accountDeleteErrorMessage(_locale: AppLocale, _error: unknown): string {
  return t(_locale, "account.danger_zone.error.delete");
}
