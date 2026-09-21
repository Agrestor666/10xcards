import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const idRowSchema = z.object({ id: z.uuid() });

interface SeededResources {
  ownerClient: SupabaseClient;
  setId: string;
  cardId: string;
  sentinel: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} before running RLS E2E tests.`);
  }
  return value;
}

export async function seedOwnedResources(): Promise<SeededResources> {
  const ownerClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: signInError,
  } = await ownerClient.auth.signInWithPassword({
    email: requireEnv("E2E_USER_EMAIL"),
    password: requireEnv("E2E_USER_PASSWORD"),
  });

  if (signInError || !user) {
    throw new Error(`Could not authenticate E2E resource owner: ${signInError?.message ?? "missing user"}`);
  }

  const sentinel = `RLS_OWNER_${crypto.randomUUID()}`;
  const { data: set, error: setError } = await ownerClient
    .from("flashcard_sets")
    .insert({ name: sentinel, user_id: user.id })
    .select("id")
    .single();

  if (setError) {
    throw new Error(`Could not seed owner set: ${setError.message}`);
  }
  const setId = idRowSchema.parse(set).id;

  const { data: card, error: cardError } = await ownerClient
    .from("flashcards")
    .insert({
      set_id: setId,
      question: `${sentinel}_QUESTION`,
      answer: `${sentinel}_ANSWER`,
    })
    .select("id")
    .single();

  if (cardError) {
    await ownerClient.from("flashcard_sets").delete().eq("id", setId);
    throw new Error(`Could not seed owner card: ${cardError.message}`);
  }
  const cardId = idRowSchema.parse(card).id;

  return {
    ownerClient,
    setId,
    cardId,
    sentinel,
  };
}

export async function cleanupOwnedResources(ownerClient: SupabaseClient, setId: string): Promise<void> {
  const { error } = await ownerClient.from("flashcard_sets").delete().eq("id", setId);
  if (error) {
    throw new Error(`Could not clean up owner set: ${error.message}`);
  }
}
