declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    locale: import("@/lib/locale").AppLocale;
  }
}
