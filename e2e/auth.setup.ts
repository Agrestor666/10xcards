import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Set E2E_USER_EMAIL and E2E_USER_PASSWORD before running Playwright E2E tests.");
  }

  await page.goto("/auth/signin");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel(/Hasło|Password/, { exact: true }).fill(password);
  await page.getByRole("button", { name: /Zaloguj się|Sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});
