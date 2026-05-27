const POSTGRES_PERMISSION_DENIED = "42501";

/**
 * Maps Supabase/Postgres errors to user-safe strings for bulk flashcard insert.
 * Never forwards raw DB messages (policy names, SQL, internal codes).
 */
export function flashcardBulkCreateErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not save cards. You do not have permission to add cards to this set.";
  }

  return "Could not save cards. Please try again.";
}

export function flashcardUpdateErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not update this card. You do not have permission to edit it.";
  }

  return "Could not update this card. Please try again.";
}

export function flashcardDeleteErrorMessage(error: { code?: string }): string {
  if (error.code === POSTGRES_PERMISSION_DENIED) {
    return "Could not delete this card. You do not have permission to delete it.";
  }

  return "Could not delete this card. Please try again.";
}
