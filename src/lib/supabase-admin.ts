import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "astro:env/server";

/** Service-role client — use only from account-deletion API routes, never from pages or normal CRUD. */
export function createAdminClient(): SupabaseClient | null {
  const url = SUPABASE_URL;
  const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
