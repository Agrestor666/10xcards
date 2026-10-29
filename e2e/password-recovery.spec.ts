/**
 * Guest password-recovery smoke: request form, identical check-email success,
 * and an invalid reset link that never reaches the dashboard.
 */
import { expect, test } from "@playwright/test";

test.describe("Password recovery — guest", () => {
  test("sign-in links to the request form and an empty submit stays there", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByRole("link", { name: /Forgot password\?|Nie pamiętasz hasła\?/ }).click();

    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await expect(page.locator("form[data-hydrated='true']")).toBeAttached();
    await page.getByRole("button", { name: /Send reset link|Wyślij link resetujący/ }).click();

    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    await expect(page.getByText(/Email is required|Email jest wymagany/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  });

  test("an unknown email ends on the check-email page", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await page.getByLabel("Email").fill(`missing-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Send reset link|Wyślij link resetujący/ }).click();

    await expect(page).toHaveURL(/\/auth\/check-email$/);
    await expect(page.getByRole("heading", { name: /Check your inbox|Sprawdź skrzynkę/ })).toBeVisible();
  });

  test("an invalid reset link offers another request and hides the dashboard", async ({ page }) => {
    await page.goto("/auth/reset-password?error=link_invalid");

    await expect(page).toHaveURL(/\/auth\/reset-password\?error=link_invalid/);
    await expect(page.getByRole("link", { name: /Request a new link|Wyślij link ponownie/ })).toHaveAttribute(
      "href",
      "/auth/forgot-password",
    );
    await expect(page.getByRole("button", { name: /New set|Nowy zestaw/ })).not.toBeVisible();
  });
});
