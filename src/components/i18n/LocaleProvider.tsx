import { createContext, useMemo, type ReactNode } from "react";
import type { AppLocale } from "@/lib/locale";
import { t as translate, type MessageKey } from "@/lib/i18n";

export interface LocaleContextValue {
  locale: AppLocale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  locale: AppLocale;
  children: ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
