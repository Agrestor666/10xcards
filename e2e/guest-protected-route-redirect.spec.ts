/**
 * Protects: context/foundation/test-plan.md Risk #5 —
 * unauthenticated caller must not reach protected pages or receive dashboard data.
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

test.describe("Auth boundary — protected route redirect (Risk #5)", () => {
  test("guest visiting /dashboard is redirected to sign in without dashboard data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.getByRole("heading", { name: /Sign in|Zaloguj się/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: /New set|Nowy zestaw/i })).not.toBeVisible();
  });
});
