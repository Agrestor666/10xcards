declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    locale: import("@/lib/locale").AppLocale;
    supabase: import("@/lib/supabase").AppSupabaseClient | null;
  }
}
