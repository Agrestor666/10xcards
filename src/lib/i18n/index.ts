import type { AppLocale } from "@/lib/locale";
import { en } from "./en";
import { pl } from "./pl";

export type MessageKey = keyof typeof en;

const messages: Record<AppLocale, Record<MessageKey, string>> = {
  en,
  pl,
};

export function getMessages(locale: AppLocale): Readonly<Record<MessageKey, string>> {
  return messages[locale];
}

export function t(locale: AppLocale, key: MessageKey, params?: Record<string, string | number>): string {
  let text = messages[locale][key];

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
    }
  }

  return text;
}
