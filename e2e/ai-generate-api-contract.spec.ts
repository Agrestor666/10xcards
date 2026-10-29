/**
 * Protects: context/foundation/test-plan.md Risk #5 (auth/input gates on generate API),
 * Risk #3 (400 responses must not echo raw over-max source text or topic).
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

// Keep in sync with src/lib/ai-generation-limits.ts MAX_SOURCE_TEXT_CHARS / MAX_TOPIC_CHARS
const MAX_SOURCE_TEXT_CHARS = 20_000;
const MAX_TOPIC_CHARS = 200;
const OVER_MAX_SENTINEL = `E2E_PRIVACY_SENTINEL_${"x".repeat(MAX_SOURCE_TEXT_CHARS)}`;
const TOPIC_SENTINEL = "E2E_TOPIC_PRIVACY_SENTINEL";
const OVER_MAX_TOPIC = `${TOPIC_SENTINEL}${"x".repeat(MAX_TOPIC_CHARS + 1 - TOPIC_SENTINEL.length)}`;

test.describe("AI generate API contract (Risk #5, Risk #3)", () => {
  test("guest POST /api/ai/generate returns 401", async ({ playwright, baseURL }) => {
    // Using inline unauthenticated context: API-layer probe with no page navigation;
    // the guest Playwright project is scoped to page-level redirect specs.
    const guestRequest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await guestRequest.post("/api/ai/generate", {
      data: { text: "hello" },
    });

    expect(response.status()).toBe(401);

    await guestRequest.dispose();
  });

  test("authenticated empty text returns 400", async ({ request }) => {
    const response = await request.post("/api/ai/generate", {
      data: { text: "" },
    });

    expect(response.status()).toBe(400);
  });

  test("authenticated whitespace-only text returns 400", async ({ request }) => {
    const response = await request.post("/api/ai/generate", {
      data: { text: "   \n\t  " },
    });

    expect(response.status()).toBe(400);
  });

  test("authenticated over-max text returns 400 without echoing raw paste", async ({ request }) => {
    const response = await request.post("/api/ai/generate", {
      data: { text: OVER_MAX_SENTINEL },
    });

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toContain("E2E_PRIVACY_SENTINEL");
    expect(body).not.toContain(OVER_MAX_SENTINEL);
  });

  test("guest POST /api/ai/generate with a topic returns 401", async ({ playwright, baseURL }) => {
    const guestRequest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await guestRequest.post("/api/ai/generate", {
      data: { mode: "topic", topic: "Photosynthesis" },
    });

    expect(response.status()).toBe(401);

    await guestRequest.dispose();
  });

  test("authenticated whitespace-only topic returns 400", async ({ request }) => {
    const response = await request.post("/api/ai/generate", {
      data: { mode: "topic", topic: "   " },
    });

    expect(response.status()).toBe(400);
  });

  test("authenticated over-max topic returns 400 without echoing the topic", async ({ request }) => {
    const response = await request.post("/api/ai/generate", {
      data: { mode: "topic", topic: OVER_MAX_TOPIC },
    });

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toContain(TOPIC_SENTINEL);
    expect(body).not.toContain(OVER_MAX_TOPIC);
  });
});
