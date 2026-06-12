import { expect, test } from "@playwright/test";

test("created set persists after page reload", async ({ page }) => {
  const setName = `Test Set ${Date.now()}`;

  await page.goto("/dashboard");
  await expect(page.getByText(/Signed in as|Zalogowano jako/i)).toBeVisible();

  // client:load islands may not be interactive immediately — retry until dialog opens
  await expect(async () => {
    const createSetButton = page
      .getByRole("button", { name: /New set|Nowy zestaw|Create your first set|Utwórz pierwszy zestaw/i })
      .first();
    await createSetButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }).toPass({ timeout: 15_000 });

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(/Biology|Biologia|np\./i).fill(setName);
  await dialog.getByRole("button", { name: /^Create$|^Utwórz$/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: setName })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: setName })).toBeVisible();

  const setHref = await page.getByRole("link", { name: setName }).getAttribute("href");
  const setId = setHref?.match(/\/sets\/([0-9a-f-]+)/i)?.[1];
  expect(setId).toBeTruthy();

  const deleteResponse = await page.request.post("/api/flashcard-sets/delete", {
    data: { id: setId },
  });
  expect(deleteResponse.ok()).toBeTruthy();

  await page.reload();
  await expect(page.getByRole("link", { name: setName })).not.toBeVisible();
});
