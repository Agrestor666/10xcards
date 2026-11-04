/**
 * Protects: auth and validation gates on POST /api/ai/read-document.
 * 400 responses must not echo file bytes. No live model call.
 * Seed: e2e/seed.spec.ts
 */
import { expect, test } from "@playwright/test";

// Keep in sync with src/lib/ai-generation-limits.ts
const MAX_DOCUMENT_BYTES = 10_485_760;
const FILE_SENTINEL = "E2E_DOCUMENT_PRIVACY_SENTINEL";

function textFile(name: string, contents: Buffer | string) {
  return {
    name,
    mimeType: "text/plain",
    buffer: Buffer.isBuffer(contents) ? contents : Buffer.from(contents),
  };
}

function oversizeFile() {
  const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
  buffer.write(FILE_SENTINEL);
  return textFile("notes.txt", buffer);
}

// Astro's CSRF check applies to multipart POST and returns 403 unless the
// request looks same-origin. A browser fetch sends these; Playwright's API client does not.
function sameOriginHeaders(baseURL: string) {
  return {
    origin: baseURL,
    "sec-fetch-site": "same-origin",
  };
}

test.describe("AI read-document API contract", () => {
  test("guest POST /api/ai/read-document returns 401 without echoing the file", async ({ playwright, baseURL }) => {
    const guestRequest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await guestRequest.post("/api/ai/read-document", {
      headers: sameOriginHeaders(baseURL ?? ""),
      multipart: {
        file: textFile("notes.txt", FILE_SENTINEL),
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(FILE_SENTINEL);

    await guestRequest.dispose();
  });

  test("authenticated missing file returns 400", async ({ request, baseURL }) => {
    const response = await request.post("/api/ai/read-document", {
      headers: sameOriginHeaders(baseURL ?? ""),
      multipart: {
        note: "no file field",
      },
    });

    expect(response.status()).toBe(400);
  });

  test("authenticated unsupported type returns 400 without echoing the file", async ({ request, baseURL }) => {
    const response = await request.post("/api/ai/read-document", {
      headers: sameOriginHeaders(baseURL ?? ""),
      multipart: {
        file: {
          name: "notes.png",
          mimeType: "image/png",
          buffer: Buffer.from(FILE_SENTINEL),
        },
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toContain(FILE_SENTINEL);
  });

  test("authenticated oversize file returns 400 without echoing the file", async ({ request, baseURL }) => {
    const response = await request.post("/api/ai/read-document", {
      headers: sameOriginHeaders(baseURL ?? ""),
      multipart: {
        file: oversizeFile(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toContain(FILE_SENTINEL);
  });
});
