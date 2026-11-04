import { SUPABASE_KEY, SUPABASE_URL, TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY } from "astro:env/server";
import type { MessageKey } from "@/lib/i18n";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  messageKey: MessageKey;
  docsUrl?: string;
  docsLabelKey?: MessageKey;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    messageKey: "config.supabase.message",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabelKey: "config.docs_label",
  },
  {
    name: "Turnstile",
    configured: Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY),
    messageKey: "config.turnstile.message",
    docsUrl: "https://developers.cloudflare.com/turnstile/get-started/",
    docsLabelKey: "config.docs_label",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
