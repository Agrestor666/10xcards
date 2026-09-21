import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "astro:env/server";

export const prerender = false;

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

export const GET: APIRoute = () => {
  const configured = Boolean(SUPABASE_URL && SUPABASE_KEY && SUPABASE_SERVICE_ROLE_KEY && OPENROUTER_API_KEY);

  return new Response(JSON.stringify({ ok: configured }), {
    status: configured ? 200 : 503,
    headers,
  });
};
