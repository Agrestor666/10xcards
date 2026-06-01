import type { APIContext } from "astro";
import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";

export type AppLocale = "en" | "pl";

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: AppLocale = "en";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "pl";
}

export function parseAcceptLanguage(header: string | null): AppLocale {
  if (!header) {
    return DEFAULT_LOCALE;
  }

  const languages = header.split(",").map((part) => {
    const [lang] = part.trim().split(";");
    return lang.trim().toLowerCase();
  });

  for (const lang of languages) {
    if (lang === "pl" || lang.startsWith("pl-")) {
      return "pl";
    }
  }

  return DEFAULT_LOCALE;
}

export function getLocaleFromCookies(cookies: AstroCookies): AppLocale | null {
  const value = cookies.get(LOCALE_COOKIE)?.value;
  return isAppLocale(value) ? value : null;
}

export function setLocaleCookie(cookies: AstroCookies, locale: AppLocale): void {
  cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: import.meta.env.PROD,
  });
}

export function resolveLocale(input: {
  user: User | null;
  cookies: AstroCookies;
  acceptLanguage: string | null;
}): AppLocale {
  if (input.user) {
    const metaLocale: unknown = input.user.user_metadata.locale;
    if (isAppLocale(metaLocale)) {
      return metaLocale;
    }
  }

  const cookieLocale = getLocaleFromCookies(input.cookies);
  if (cookieLocale) {
    return cookieLocale;
  }

  return parseAcceptLanguage(input.acceptLanguage);
}

export function localeToBcp47(locale: AppLocale): string {
  return locale === "pl" ? "pl-PL" : "en-US";
}

/** Resolve locale for API routes (`locals.locale` is set in middleware on every request). */
export function getLocaleFromContext(context: APIContext): AppLocale {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guard against edge cases where middleware didn't run
  return context.locals.locale ?? DEFAULT_LOCALE;
}
