import { expect, test } from "@playwright/test";

const missingTokenPosts = [
  {
    path: "/api/auth/signin",
    fields: { email: "user@example.test", password: "LocalE2E-Only-2026!" },
    redirect: "/auth/signin?error=captcha_failed",
  },
  {
    path: "/api/auth/signup",
    fields: { email: "new-user@example.test", password: "LocalE2E-Only-2026!" },
    redirect: "/auth/signup?error=captcha_failed",
  },
  {
    path: "/api/auth/forgot-password",
    fields: { email: "user@example.test" },
    redirect: "/auth/forgot-password?error=captcha_failed",
  },
] as const;

test.describe("Turnstile bot protection on public auth posts", () => {
  for (const route of missingTokenPosts) {
    test(`POST ${route.path} without a Turnstile token redirects to captcha_failed`, async ({ request, baseURL }) => {
      const origin = baseURL.replace(/\/$/, "");
      const response = await request.post(route.path, {
        form: { ...route.fields },
        headers: { Origin: origin },
        maxRedirects: 0,
      });

      expect(response.status()).toBe(302);
      expect(response.headers().location).toContain(route.redirect);
    });
  }

  test("sign-in page shows the localized captcha failure alert", async ({ page }) => {
    await page.goto("/auth/signin?error=captcha_failed");

    await expect(page.getByText("Security verification failed. Please try again.")).toBeVisible();
  });
});
