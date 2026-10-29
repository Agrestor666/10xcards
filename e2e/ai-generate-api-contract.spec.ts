/**
 * Protects: context/foundation/test-plan.md Risk #5 (auth/input gates on generate API),
 * Risk #3 (400 responses must not echo raw over-max source text, topic, or photo payload).
 * Photo gates reject guests and bad transcribe/transcript bodies without a live vision call.
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

// Keep in sync with src/lib/ai-generation-limits.ts
const MAX_SOURCE_TEXT_CHARS = 20_000;
const MAX_TOPIC_CHARS = 200;
const MAX_PHOTO_BYTES = 1_500_000;
const MAX_PHOTO_COUNT = 3;
const OVER_MAX_SENTINEL = `E2E_PRIVACY_SENTINEL_${"x".repeat(MAX_SOURCE_TEXT_CHARS)}`;
const TOPIC_SENTINEL = "E2E_TOPIC_PRIVACY_SENTINEL";
const OVER_MAX_TOPIC = `${TOPIC_SENTINEL}${"x".repeat(MAX_TOPIC_CHARS + 1 - TOPIC_SENTINEL.length)}`;
const TRANSCRIPT_SENTINEL = "E2E_TRANSCRIPT_PRIVACY_SENTINEL";
const OVER_MAX_TRANSCRIPT = `${TRANSCRIPT_SENTINEL}${"x".repeat(MAX_SOURCE_TEXT_CHARS)}`;
const TINY_JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
// 20 chars, length divisible by 4, so it can sit at the start of a valid base64 body.
const PHOTO_SENTINEL = "E2EPHOTOSENTINELPRIV";

function oversizeJpegDataUrl(): string {
  const minFourCharGroups = Math.ceil((MAX_PHOTO_BYTES + 1) / 3);
  const paddingGroups = Math.max(1, minFourCharGroups - PHOTO_SENTINEL.length / 4);
  return `data:image/jpeg;base64,${PHOTO_SENTINEL}${"AAAA".repeat(paddingGroups)}`;
}

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

  test("guest POST /api/ai/transcribe returns 401", async ({ playwright, baseURL }) => {
    const guestRequest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await guestRequest.post("/api/ai/transcribe", {
      data: { images: [TINY_JPEG_DATA_URL] },
    });

    expect(response.status()).toBe(401);

    await guestRequest.dispose();
  });

  test("authenticated empty images returns 400", async ({ request }) => {
    const response = await request.post("/api/ai/transcribe", {
      data: { images: [] },
    });

    expect(response.status()).toBe(400);
  });

  test("authenticated four images returns 400", async ({ request }) => {
    const response = await request.post("/api/ai/transcribe", {
      data: { images: Array.from({ length: MAX_PHOTO_COUNT + 1 }, () => TINY_JPEG_DATA_URL) },
    });

    expect(response.status()).toBe(400);
  });

  test("authenticated oversize image returns 400 without echoing the payload", async ({ request }) => {
    const oversizeDataUrl = oversizeJpegDataUrl();
    const response = await request.post("/api/ai/transcribe", {
      data: { images: [oversizeDataUrl] },
    });

    expect(response.status()).toBe(400);
    const base64 = oversizeDataUrl.slice("data:image/jpeg;base64,".length);
    expect(base64.length % 4).toBe(0);
    expect((base64.length / 4) * 3).toBeGreaterThan(MAX_PHOTO_BYTES);
    const body = await response.text();
    expect(body).not.toContain(PHOTO_SENTINEL);
    expect(body).not.toContain(oversizeDataUrl);
  });

  test("guest POST /api/ai/generate with a transcript returns 401", async ({ playwright, baseURL }) => {
    const guestRequest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await guestRequest.post("/api/ai/generate", {
      data: { mode: "transcript", text: "Printed note" },
    });

    expect(response.status()).toBe(401);

    await guestRequest.dispose();
  });

  test("authenticated empty transcript text returns 400 without echoing the sentinel", async ({ request }) => {
    for (const text of ["", "   \n\t  "]) {
      const response = await request.post("/api/ai/generate", {
        // `source` is ignored by the handler. It exists so a body echo would fail this test.
        data: { mode: "transcript", text, source: TRANSCRIPT_SENTINEL },
      });

      expect(response.status()).toBe(400);
      const body = await response.text();
      expect(body).not.toContain(TRANSCRIPT_SENTINEL);
    }
  });

  test("authenticated over-max transcript text returns 400 without echoing the sentinel", async ({ request }) => {
    const response = await request.post("/api/ai/generate", {
      data: { mode: "transcript", text: OVER_MAX_TRANSCRIPT },
    });

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toContain(TRANSCRIPT_SENTINEL);
    expect(body).not.toContain(OVER_MAX_TRANSCRIPT);
  });
});
