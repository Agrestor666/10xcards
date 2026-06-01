import type { APIRoute } from "astro";
import { isAppLocale, setLocaleCookie } from "@/lib/locale";

export const prerender = false;

export const GET: APIRoute = (context) => {
  const langParam = context.url.searchParams.get("lang");

  if (context.locals.user) {
    return context.redirect("/dashboard");
  }

  if (!isAppLocale(langParam)) {
    return context.redirect("/");
  }

  setLocaleCookie(context.cookies, langParam);

  const referer = context.request.headers.get("Referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin === context.url.origin) {
        const path = `${refererUrl.pathname}${refererUrl.search}`;
        if (refererUrl.pathname.startsWith("/") && !refererUrl.pathname.startsWith("//")) {
          return context.redirect(path);
        }
      }
    } catch {
      // Ignore malformed referer URLs.
    }
  }

  return context.redirect("/");
};
