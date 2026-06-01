import type { APIRoute } from "astro";
import { isAppLocale, setLocaleCookie } from "@/lib/locale";

export const prerender = false;

export const GET: APIRoute = (context) => {
  const langParam = context.url.searchParams.get("lang");

  if (!isAppLocale(langParam)) {
    return context.redirect("/");
  }

  setLocaleCookie(context.cookies, langParam);

  const referer = context.request.headers.get("Referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin === context.url.origin) {
        return context.redirect(`${refererUrl.pathname}${refererUrl.search}`);
      }
    } catch {
      // Ignore malformed referer URLs.
    }
  }

  return context.redirect("/");
};
