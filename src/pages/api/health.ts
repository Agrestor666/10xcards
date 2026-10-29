import type { APIRoute } from "astro";
import {
  OPENROUTER_API_KEY,
  SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  TURNSTILE_SECRET_KEY,
  TURNSTILE_SITE_KEY,
} from "astro:env/server";

export const prerender = false;

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

export const GET: APIRoute = () => {
  const configured = Boolean(
    SUPABASE_URL &&
    SUPABASE_KEY &&
    SUPABASE_SERVICE_ROLE_KEY &&
    OPENROUTER_API_KEY &&
    TURNSTILE_SITE_KEY &&
    TURNSTILE_SECRET_KEY,
  );

  return new Response(JSON.stringify({ ok: configured }), {
    status: configured ? 200 : 503,
    headers,
  });
};
