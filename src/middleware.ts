import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { getLocaleFromCookies, resolveLocale, setLocaleCookie } from "@/lib/locale";

const PROTECTED_ROUTES = ["/dashboard", "/sets", "/settings"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  const { pathname } = context.url;
  if (context.locals.user) {
    if (pathname === "/" || pathname === "/auth/signin" || pathname === "/auth/signup") {
      return context.redirect("/dashboard");
    }
  }

  const locale = resolveLocale({
    user: context.locals.user,
    cookies: context.cookies,
    acceptLanguage: context.request.headers.get("Accept-Language"),
  });

  if (!getLocaleFromCookies(context.cookies)) {
    setLocaleCookie(context.cookies, locale);
  }

  context.locals.locale = locale;

  return next();
});
