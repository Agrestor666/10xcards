import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { getLocaleFromCookies, resolveLocale, setLocaleCookie } from "@/lib/locale";

const PROTECTED_ROUTES = ["/dashboard", "/sets", "/settings"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  context.locals.supabase = supabase;

  if (supabase) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        const isFatalAuthError =
          error.code === "refresh_token_not_found" || error.code === "session_not_found" || error.status === 401;

        if (isFatalAuthError) {
          await supabase.auth.signOut();
        }
        context.locals.user = null;
      } else {
        context.locals.user = user ?? null;
      }
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore secondary sign-out failures
      }
      context.locals.user = null;
    }
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
