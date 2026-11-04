/**
 * Protects: photo-mode generation on /dashboard with mocked transcribe and generate.
 * Drafts must survive a From text / From photo switch. Camera capture stays manual.
 * Seed: e2e/seed.spec.ts
 */
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const FIXTURE_JPEG = join(import.meta.dirname, "fixtures", "printed-note.jpg");
const MOCK_TRANSCRIPT = "Printed page about photosynthesis";
const EDITED_TRANSCRIPT = "Printed page about chlorophyll";
const QUESTION_ONE = "E2E photo question one";
const ANSWER_ONE = "E2E photo answer one";
const QUESTION_TWO = "E2E photo question two";
const ANSWER_TWO = "E2E photo answer two";

test("photo mode reads a fixture, generates drafts from the edited transcript, and keeps them across mode switches", async ({
  page,
}) => {
  let generatePayload: { mode?: string; text?: string } | undefined;

  await page.route("**/api/ai/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        text: MOCK_TRANSCRIPT,
        skipped: [],
      }),
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

  const photoButton = page.getByRole("button", { name: /From photo|Ze zdjęcia/i });
  const readButton = page.getByRole("button", { name: /Read text|Odczytaj tekst/i });
  const fileInput = page.locator('input[type="file"][multiple]');
  // client:load may drop the first click if it lands before hydration
  await expect(async () => {
    await photoButton.click();
    await expect(readButton).toBeVisible();
  }).toPass({ timeout: 15_000 });

  await fileInput.setInputFiles(FIXTURE_JPEG);

  await expect(page.getByRole("img", { name: /Photo 1|Zdjęcie 1/ })).toBeVisible();
  await expect(readButton).toBeEnabled();
  await readButton.click();

  const transcript = page.getByRole("textbox", { name: /^(Transcript|Transkrypcja)$/ });
  await expect(transcript).toHaveValue(MOCK_TRANSCRIPT);

  const generateButton = page.getByRole("button", { name: /^Generate$|^Generuj$/i });
  await expect(async () => {
    await transcript.fill(EDITED_TRANSCRIPT);
    await expect(transcript).toHaveValue(EDITED_TRANSCRIPT);
    await expect(generateButton).toBeEnabled();
  }).toPass({ timeout: 15_000 });
  await generateButton.click();

  const questions = page.getByRole("textbox", { name: /Question|Pytanie/i });
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);
  await expect(questions.nth(1)).toHaveValue(QUESTION_TWO);
  expect(generatePayload).toMatchObject({ mode: "transcript", text: EDITED_TRANSCRIPT });

  await page.getByRole("button", { name: /From text|Z tekstu/i }).click();
  await expect(page.getByRole("textbox", { name: /Paste your notes|Wklej tutaj/i })).toBeVisible();
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);

  await photoButton.click();
  await expect(transcript).toBeVisible();
  await expect(transcript).toHaveValue(EDITED_TRANSCRIPT);
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toHaveValue(QUESTION_ONE);
  await expect(questions.nth(1)).toHaveValue(QUESTION_TWO);
});
