/** Shown when server env lacks the Supabase service role key. */
export const SUPABASE_ADMIN_NOT_CONFIGURED_MESSAGE =
  "Account deletion is not available. The server is missing required configuration.";

/**
 * Maps delete-account failures to user-safe strings.
 * Log the raw error server-side; never forward internal details to the client.
 */
export function accountDeleteErrorMessage(_error: unknown): string {
  return "Could not delete your account. Please try again or contact support.";
}
