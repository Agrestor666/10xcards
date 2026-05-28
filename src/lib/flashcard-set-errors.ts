/** Shown when server env lacks Supabase URL/key. */
export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Check SUPABASE_URL and SUPABASE_KEY in your environment.";

const POSTGRES_PERMISSION_DENIED = "42501";

/**
 * Maps Supabase/Postgres errors to user-safe strings for the create-set flow.
 * Never forwards raw DB messages (policy names, SQL, internal codes).
 */
export function flashcardSetCreateErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not create set. You do not have permission to perform this action.";
  }

  return "Could not create set. Please try again.";
}

export function flashcardSetUpdateErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not rename set. You do not have permission to edit it.";
  }

  return "Could not rename set. Please try again.";
}

export function flashcardSetDeleteErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not delete set. You do not have permission to delete it.";
  }

  return "Could not delete set. Please try again.";
}
