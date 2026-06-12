/**
 * Protects: context/foundation/test-plan.md Risk #4 —
 * failed generation shows a safe error banner, not draft cards (no false success).
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

test("failed AI generate shows error banner and no draft cards (Risk #4)", async ({ page }) => {
  const sourceText = `E2E generate failure ${Date.now()}`;

  await page.route("**/api/ai/generate", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, errorKey: "generator.error.generate" }),
    });
  });

  await page.goto("/dashboard");
  await expect(page.getByText(/Signed in as|Zalogowano jako/i)).toBeVisible();

  // Expand generator panel once — <details> toggles closed on repeat clicks
  await page.getByText(/Generate flashcards with AI|Generuj fiszki z AI/i).click();
  const sourceTextbox = page.getByRole("textbox", { name: /Paste your notes|Wklej tutaj/i });
  await expect(sourceTextbox).toBeVisible({ timeout: 15_000 });

  // Fill source text and trigger generate
  const generateButton = page.getByRole("button", { name: /^Generate$|^Generuj$/i });
  await expect(async () => {
    await sourceTextbox.click();
    await sourceTextbox.fill("");
    await sourceTextbox.pressSequentially(sourceText, { delay: 5 });
    await expect(generateButton).toBeEnabled();
  }).toPass({ timeout: 15_000 });
  await generateButton.click();

  // Error banner visible (destructive styling path in FlashcardGenerator)
  await expect(page.getByText(/Could not generate flashcards|Nie udało się wygenerować fiszek/i)).toBeVisible();

  // No draft card rows — empty state and 0/N count remain
  await expect(page.getByText(/Generate to see cards here|Wygeneruj fiszki, aby zobaczyć/i)).toBeVisible();
  await expect(page.getByText(/^0\/50$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Remove|Usuń/i })).not.toBeVisible();

  // Generate control returns to idle (not stuck on "Generating…")
  await expect(page.getByRole("button", { name: /^Generate$|^Generuj$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Generating|Generowanie/i })).not.toBeVisible();
});
