/**
 * Protects: topic-mode generation on /dashboard (mocked OpenRouter) and inline
 * new-set save with live grid sync. Drafts must survive From text / From topic switches.
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

const TOPIC = "Photosynthesis in plants";
const QUESTION_ONE = "E2E topic question one";
const ANSWER_ONE = "E2E topic answer one";
const QUESTION_TWO = "E2E topic question two";
const ANSWER_TWO = "E2E topic answer two";

test("topic mode generates drafts and saves them to a new inline set", async ({ page }) => {
  const setName = `E2E Topic Set ${Date.now()}`;
  let generatePayload: { mode?: string; topic?: string } | undefined;

  await page.route("**/api/ai/generate", async (route) => {
    generatePayload = route.request().postDataJSON() as { mode?: string; topic?: string };
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

  const topicButton = page.getByRole("button", { name: /From topic|Z tematu/i });
  const topicInput = page.getByRole("textbox", { name: /^(Topic|Temat)$/ });
  // client:load may drop the first click if it lands before hydration
  await expect(async () => {
    await topicButton.click();
    await expect(topicInput).toBeVisible();
  }).toPass({ timeout: 15_000 });

  const generateButton = page.getByRole("button", { name: /^Generate$|^Generuj$/i });
  await expect(async () => {
    await topicInput.click();
    await topicInput.fill("");
    await topicInput.fill(TOPIC);
    await expect(generateButton).toBeEnabled();
  }).toPass({ timeout: 15_000 });
  await generateButton.click();

  expect(generatePayload).toMatchObject({ mode: "topic", topic: TOPIC });

  const questions = page.getByRole("textbox", { name: /Question|Pytanie/i });
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);
  await expect(questions.nth(1)).toHaveValue(QUESTION_TWO);
  await expect(page.getByText(/^2\/50$/)).toBeVisible();

  await page.getByRole("button", { name: /From text|Z tekstu/i }).click();
  await expect(page.getByRole("textbox", { name: /Paste your notes|Wklej tutaj/i })).toBeVisible();
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);

  await page.getByRole("button", { name: /From topic|Z tematu/i }).click();
  await expect(topicInput).toBeVisible();
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);
  await expect(questions.nth(1)).toHaveValue(QUESTION_TWO);

  const setSelect = page.getByLabel(/Save to set|Zapisz do zestawu/i);
  const newSetNameInput = page.getByLabel(/New set name|Nazwa nowego zestawu/i);
  await expect(async () => {
    await setSelect.selectOption("__new__");
    await expect(newSetNameInput).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await newSetNameInput.fill(setName);

  await page.getByRole("button", { name: /^Save$|^Zapisz$/i }).click();

  await expect(
    page.getByText(new RegExp(`(Saved 2 card\\(s\\) to ${setName}\\.)|(Zapisano 2 fiszek do ${setName}\\.)`)),
  ).toBeVisible();
  await expect(page.getByText(/^0\/50$/)).toBeVisible();
  await expect(questions).toHaveCount(0);

  const setLink = page.getByRole("link", { name: setName, exact: true });
  await expect(setLink).toBeVisible();
  await expect(page.locator("article").filter({ has: setLink })).toContainText(
    /2 cards · 2 due|2 fiszki · 2 do powtórki/,
  );

  const setId = (await setLink.getAttribute("href"))?.match(/\/sets\/([0-9a-f-]+)/i)?.[1];
  expect(setId).toBeTruthy();
  const deleteResponse = await page.request.post("/api/flashcard-sets/delete", {
    data: { id: setId },
  });
  expect(deleteResponse.ok()).toBeTruthy();
});
