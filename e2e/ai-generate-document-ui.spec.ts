/**
 * Protects: document-mode generation on /dashboard with mocked read and generate.
 * Generate stays disabled above 20_000 characters. Save still posts bulk-create.
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

// Keep in sync with src/lib/ai-generation-limits.ts
const MAX_SOURCE_TEXT_CHARS = 20_000;
const OVER_LIMIT_TEXT = "x".repeat(MAX_SOURCE_TEXT_CHARS + 1);
const EDITED_TEXT = "Edited document paragraph about chlorophyll";
const QUESTION_ONE = "E2E document question one";
const ANSWER_ONE = "E2E document answer one";
const QUESTION_TWO = "E2E document question two";
const ANSWER_TWO = "E2E document answer two";

test("document mode reads a file, gates long text, generates from the edit, and saves", async ({ page }) => {
  const setName = `E2E Document Set ${Date.now()}`;
  let generatePayload: { mode?: string; text?: string } | undefined;

  await page.route("**/api/ai/read-document", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, text: OVER_LIMIT_TEXT }),
    });
  });

  await page.route("**/api/ai/generate", async (route) => {
    generatePayload = route.request().postDataJSON() as { mode?: string; text?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cards: [
          { question: QUESTION_ONE, answer: ANSWER_ONE },
          { question: QUESTION_TWO, answer: ANSWER_TWO },
        ],
      }),
    });
  });

  await page.goto("/dashboard");
  await expect(page.getByText(/Signed in as|Zalogowano jako/i)).toBeVisible();

  await page.getByText(/Generate flashcards with AI|Generuj fiszki z AI/i).click();

  const documentButton = page.getByRole("button", { name: /From document|Z dokumentu/i });
  const readButton = page.getByRole("button", { name: /Read text|Odczytaj tekst/i });
  const fileInput = page.locator('input[type="file"]');
  // client:load may drop the first click if it lands before hydration
  await expect(async () => {
    await documentButton.click();
    await expect(readButton).toBeVisible();
  }).toPass({ timeout: 15_000 });

  await fileInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("fixture"),
  });
  await expect(page.getByText("notes.txt")).toBeVisible();
  await expect(readButton).toBeEnabled();
  await readButton.click();

  const documentText = page.getByRole("textbox", { name: /^(Document text|Tekst dokumentu)$/ });
  await expect(documentText).toHaveValue(OVER_LIMIT_TEXT);
  await expect(
    page.getByText(
      new RegExp(`(This text is ${OVER_LIMIT_TEXT.length} characters)|(Ten tekst ma ${OVER_LIMIT_TEXT.length} znaków)`),
    ),
  ).toBeVisible();

  const generateButton = page.getByRole("button", { name: /^Generate$|^Generuj$/i });
  await expect(generateButton).toBeDisabled();

  await expect(async () => {
    await documentText.fill(EDITED_TEXT);
    await expect(documentText).toHaveValue(EDITED_TEXT);
    await expect(generateButton).toBeEnabled();
  }).toPass({ timeout: 15_000 });
  await generateButton.click();

  const questions = page.getByRole("textbox", { name: /Question|Pytanie/i });
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);
  await expect(questions.nth(1)).toHaveValue(QUESTION_TWO);
  expect(generatePayload).toMatchObject({ mode: "document", text: EDITED_TEXT });

  const setSelect = page.getByLabel(/Save to set|Zapisz do zestawu/i);
  const newSetNameInput = page.getByLabel(/New set name|Nazwa nowego zestawu/i);
  await expect(async () => {
    await setSelect.selectOption("__new__");
    await expect(newSetNameInput).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await newSetNameInput.fill(setName);

  const bulkRequest = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().includes("/api/flashcards/bulk-create"),
  );
  await page.getByRole("button", { name: /^Save$|^Zapisz$/i }).click();
  const bulkPayload = (await bulkRequest).postDataJSON() as {
    setId?: string;
    cards?: { question: string; answer: string }[];
  };

  await expect(
    page.getByText(new RegExp(`(Saved 2 card\\(s\\) to ${setName}\\.)|(Zapisano 2 fiszek do ${setName}\\.)`)),
  ).toBeVisible({ timeout: 15_000 });
  expect(bulkPayload.cards).toEqual([
    { question: QUESTION_ONE, answer: ANSWER_ONE },
    { question: QUESTION_TWO, answer: ANSWER_TWO },
  ]);
  expect(bulkPayload.setId).toBeTruthy();

  const setLink = page.getByRole("link", { name: setName, exact: true });
  await expect(setLink).toBeVisible();
  const setId = (await setLink.getAttribute("href"))?.match(/\/sets\/([0-9a-f-]+)/i)?.[1];
  expect(setId).toBe(bulkPayload.setId);
  const deleteResponse = await page.request.post("/api/flashcard-sets/delete", {
    data: { id: setId },
  });
  expect(deleteResponse.ok()).toBeTruthy();
});
