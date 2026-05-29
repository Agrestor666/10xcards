/** Row shape for `public.flashcard_sets` (Supabase returns timestamptz as ISO strings). */
export interface FlashcardSet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Row shape for `public.flashcards`. */
export interface Flashcard {
  id: string;
  set_id: string;
  question: string;
  answer: string;
  srs_state: Record<string, unknown>;
  due_at: string;
  created_at: string;
  updated_at: string;
}

/** Dashboard list row with card and due counts for study hub tiles. */
export type DashboardSetRow = Pick<FlashcardSet, "id" | "name" | "created_at" | "updated_at"> & {
  card_count: number;
  due_count: number;
};

export type FlashcardSetInsert = Pick<FlashcardSet, "user_id" | "name">;

export type FlashcardInsert = Pick<Flashcard, "set_id" | "question" | "answer"> &
  Partial<Pick<Flashcard, "srs_state" | "due_at">>;
