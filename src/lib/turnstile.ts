import { TURNSTILE_SECRET_KEY } from "astro:env/server";

export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
export const TURNSTILE_DUMMY_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

export function extractTurnstileToken(form: FormData): string {
  const value = form.get(TURNSTILE_RESPONSE_FIELD);
  return typeof value === "string" ? value.trim() : "";
}

export function resolveClientIp(headers: Headers): string | undefined {
  const connectingIp = headers.get("CF-Connecting-IP")?.trim();
  if (connectingIp) {
    return connectingIp;
  }

  const forwarded = headers.get("X-Forwarded-For");
  if (!forwarded) {
    return undefined;
  }

  const first = forwarded.split(",")[0]?.trim();
  return first || undefined;
}

export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string;
  secretKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const secret = input.secretKey ?? TURNSTILE_SECRET_KEY;
  const token = input.token;
  if (!secret || !token || token.length > MAX_TOKEN_LENGTH) {
    return false;
  }

  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
