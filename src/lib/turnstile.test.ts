import { describe, expect, it, vi } from "vitest";

const mockSecret = vi.hoisted(() => ({ value: "" }));

vi.mock("astro:env/server", () => ({
  get TURNSTILE_SECRET_KEY() {
    return mockSecret.value;
  },
}));

import { resolveAuthErrorMessage } from "@/lib/auth-errors";
import { extractTurnstileToken, resolveClientIp, verifyTurnstileToken } from "@/lib/turnstile";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

describe("extractTurnstileToken", () => {
  it("returns a trimmed cf-turnstile-response value", () => {
    const form = new FormData();
    form.set("cf-turnstile-response", "  token-value  ");

    expect(extractTurnstileToken(form)).toBe("token-value");
  });

  it("returns an empty string when the field is missing or not a string", () => {
    expect(extractTurnstileToken(new FormData())).toBe("");

    const form = new FormData();
    form.set("cf-turnstile-response", new Blob(["not-a-token"]));
    expect(extractTurnstileToken(form)).toBe("");
  });
});

describe("resolveClientIp", () => {
  it("prefers CF-Connecting-IP over X-Forwarded-For", () => {
    const headers = new Headers({
      "CF-Connecting-IP": "203.0.113.9",
      "X-Forwarded-For": "198.51.100.4, 203.0.113.9",
    });

    expect(resolveClientIp(headers)).toBe("203.0.113.9");
  });

  it("uses the first address in X-Forwarded-For when CF-Connecting-IP is absent", () => {
    const headers = new Headers({
      "X-Forwarded-For": " 198.51.100.4 , 203.0.113.9",
    });

    expect(resolveClientIp(headers)).toBe("198.51.100.4");
  });

  it("returns undefined when neither header is present", () => {
    expect(resolveClientIp(new Headers())).toBeUndefined();
  });
});

describe("verifyTurnstileToken", () => {
  it("returns false for a missing, empty, or overlong token without calling fetch", async () => {
    const fetchImpl = vi.fn();

    await expect(verifyTurnstileToken({ token: "", secretKey: "secret", fetchImpl })).resolves.toBe(false);
    await expect(verifyTurnstileToken({ token: "x".repeat(2049), secretKey: "secret", fetchImpl })).resolves.toBe(
      false,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns false when the secret key is missing without calling fetch", async () => {
    const fetchImpl = vi.fn();
    mockSecret.value = "";

    await expect(verifyTurnstileToken({ token: "token-value", fetchImpl })).resolves.toBe(false);
    await expect(verifyTurnstileToken({ token: "token-value", secretKey: "", fetchImpl })).resolves.toBe(false);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns true and forwards secret, response, and remoteip when siteverify succeeds", async () => {
    const fetchImpl = vi.fn(() => Response.json({ success: true }));

    await expect(
      verifyTurnstileToken({
        token: "token-value",
        remoteIp: "203.0.113.5",
        secretKey: "secret-value",
        fetchImpl,
      }),
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const params = init.body as URLSearchParams;
    expect(params.get("secret")).toBe("secret-value");
    expect(params.get("response")).toBe("token-value");
    expect(params.get("remoteip")).toBe("203.0.113.5");
  });

  it("returns false when siteverify reports failure", async () => {
    const fetchImpl = vi.fn(() => Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }));

    await expect(verifyTurnstileToken({ token: "token-value", secretKey: "secret", fetchImpl })).resolves.toBe(false);
  });

  it("returns false when siteverify responds with a non-2xx status", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 500 })));

    await expect(verifyTurnstileToken({ token: "token-value", secretKey: "secret", fetchImpl })).resolves.toBe(false);
  });

  it("returns false when siteverify throws a network or timeout error", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("The operation was aborted")));

    await expect(verifyTurnstileToken({ token: "token-value", secretKey: "secret", fetchImpl })).resolves.toBe(false);
  });
});

describe("resolveAuthErrorMessage captcha_failed", () => {
  it("maps captcha_failed to the English and Polish messages", () => {
    expect(resolveAuthErrorMessage("en", "captcha_failed")).toBe("Security verification failed. Please try again.");
    expect(resolveAuthErrorMessage("pl", "captcha_failed")).toBe(
      "Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie.",
    );
  });
});
