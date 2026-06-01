import type { AppLocale } from "@/lib/locale";
import { en } from "./en";
import { pl } from "./pl";

export type MessageKey = keyof typeof en;

const messages: Record<AppLocale, Record<MessageKey, string>> = {
  en,
  pl,
};

const runtimeMessages: Record<AppLocale, Record<string, string>> = {
  en,
  pl,
};

export function getMessages(locale: AppLocale): Readonly<Record<MessageKey, string>> {
  return messages[locale];
}

function getMessage(map: Record<string, string>, key: string): string | undefined {
  return map[key];
}

function resolveText(locale: AppLocale, key: MessageKey): string {
  const primary = getMessage(runtimeMessages[locale], key);
  if (primary !== undefined) {
    return primary;
  }

  const english = getMessage(runtimeMessages.en, key);
  if (english !== undefined) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- dev-only missing key warning
      console.warn(`Missing i18n key for locale ${locale}: ${key}`);
    }
    return english;
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- dev-only missing key warning
    console.warn(`Missing i18n key: ${key}`);
  }
  return key;
}

export function t(locale: AppLocale, key: MessageKey, params?: Record<string, string | number>): string {
  let text = resolveText(locale, key);

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
    }
  }

  return text;
}

export type PluralForm = "one" | "few" | "many" | "other";

export function getPluralForm(locale: AppLocale, count: number): PluralForm {
  if (locale === "pl") {
    if (count === 1) {
      return "one";
    }
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return "few";
    }
    return "many";
  }

  return count === 1 ? "one" : "other";
}

export function tPlural(
  locale: AppLocale,
  keyPrefix: string,
  count: number,
  params?: Record<string, string | number>,
): string {
  const form = getPluralForm(locale, count);
  const key = `${keyPrefix}_${form}` as MessageKey;
  return t(locale, key, { count, ...params });
}
