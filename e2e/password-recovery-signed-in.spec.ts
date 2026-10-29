/**
 * Signed-in session from auth.setup.ts must not stay on the reset request form.
 */
import { expect, test } from "@playwright/test";

test("signed-in visit to the reset request lands on the dashboard", async ({ page }) => {
  await page.goto("/auth/forgot-password");

  await expect(page).toHaveURL(/\/dashboard\/?$/);
});
