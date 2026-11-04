import { describe, expect, it, vi } from "vitest";

import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_EXTRACT_CHARS, MAX_DOCUMENT_PAGES } from "@/lib/ai-generation-limits";
import { handleAiReadDocumentRequest } from "@/lib/ai-read-document-handler";
import type { AiGenerateHandlerSupabase } from "@/lib/ai-generate-handler";
import type { DocumentKind, ReadDocumentTextResult } from "@/lib/document-text";
import { t } from "@/lib/i18n";

const SENTINEL = "E2E_READ_DOCUMENT_SENTINEL_xyzzy_42";
const AUTHENTICATED_USER = { id: "user-abc-123" };

function createSupabaseMock(overrides?: Partial<AiGenerateHandlerSupabase>): AiGenerateHandlerSupabase & {
  fromCalls: string[];
} {
  const fromCalls: string[] = [];
  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    return {};
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: AUTHENTICATED_USER },
        error: null,
      }),
    },
    from,
    fromCalls,
    ...overrides,
  };
}

function fileRequest(files: { name: string; bytes: Uint8Array; field?: string }[]): Request {
  const form = new FormData();
  for (const file of files) {
    form.append(file.field ?? "file", new File([file.bytes], file.name));
  }

  return new Request("http://localhost/api/ai/read-document", { method: "POST", body: form });
}

function textFile(contents: string, name = "notes.txt"): Request {
  return fileRequest([{ name, bytes: new TextEncoder().encode(contents) }]);
}

describe("handleAiReadDocumentRequest", () => {
  function readers(readResult: ReadDocumentTextResult = { ok: true, text: "Chapter one" }) {
    const readDocumentText = vi.fn((_bytes: Uint8Array, _kind: DocumentKind) => Promise.resolve(readResult));
    const transcribePdf = vi.fn((_bytes: Uint8Array) => Promise.resolve({ ok: true as const, text: "Scanned line" }));
    return { readDocumentText, transcribePdf };
  }

  it("returns 401 and does not read the file when unauthenticated", async () => {
    const supabase = createSupabaseMock({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
    const { readDocumentText, transcribePdf } = readers();

    const result = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: textFile(SENTINEL),
      readDocumentText,
      transcribePdf,
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, message: t("en", "api.error.sign_in_generate") });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(readDocumentText).not.toHaveBeenCalled();
    expect(transcribePdf).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 for a missing file, an extra file, and a non-multipart body without echoing bytes", async () => {
    const supabase = createSupabaseMock();
    const { readDocumentText, transcribePdf } = readers();
    const emptyForm = new FormData();
    emptyForm.append("note", SENTINEL);
    const cases = [
      fileRequest([
        { name: "a.txt", bytes: new TextEncoder().encode(SENTINEL) },
        { name: "b.txt", bytes: new TextEncoder().encode("second") },
      ]),
      new Request("http://localhost/api/ai/read-document", { method: "POST", body: emptyForm }),
      new Request("http://localhost/api/ai/read-document", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: SENTINEL }),
      }),
    ];

    for (const request of cases) {
      const result = await handleAiReadDocumentRequest({
        locale: "en",
        supabase,
        request,
        readDocumentText,
        transcribePdf,
      });

      expect(result.status).toBe(400);
      expect(result.body).toEqual({ ok: false, message: t("en", "api.error.invalid_body") });
      expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    }

    expect(readDocumentText).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 for an unsupported type and for magic that disagrees with the extension", async () => {
    const supabase = createSupabaseMock();
    const { readDocumentText, transcribePdf } = readers();
    const requests = [
      fileRequest([{ name: "notes.png", bytes: new TextEncoder().encode(SENTINEL) }]),
      fileRequest([{ name: "notes.txt", bytes: new TextEncoder().encode(`%PDF-1.4 ${SENTINEL}`) }]),
    ];

    for (const request of requests) {
      const result = await handleAiReadDocumentRequest({
        locale: "en",
        supabase,
        request,
        readDocumentText,
        transcribePdf,
      });

      expect(result.status).toBe(400);
      expect(result.body).toEqual({ ok: false, message: t("en", "generator.error.document_unsupported") });
      expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    }

    expect(readDocumentText).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 for an oversize file without reading it or echoing bytes", async () => {
    const supabase = createSupabaseMock();
    const { readDocumentText, transcribePdf } = readers();
    const bytes = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    bytes.set(new TextEncoder().encode(SENTINEL));

    const result = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: fileRequest([{ name: "huge.txt", bytes }]),
      readDocumentText,
      transcribePdf,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      message: t("en", "generator.error.document_too_large", { max: 10 }),
    });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(readDocumentText).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns 400 for empty text and omits text that is over the extract cap", async () => {
    const supabase = createSupabaseMock();
    const emptyReaders = readers({ ok: true, text: "  \n" });
    const empty = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: textFile("ignored"),
      ...emptyReaders,
    });

    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ ok: false, message: t("en", "generator.error.document_no_text") });
    expect(emptyReaders.transcribePdf).not.toHaveBeenCalled();

    const extracted = `${SENTINEL}${"x".repeat(MAX_DOCUMENT_EXTRACT_CHARS)}`;
    const longReaders = readers({ ok: true, text: extracted });
    const tooLong = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: textFile("ignored"),
      ...longReaders,
    });

    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({
      ok: false,
      message: t("en", "generator.error.document_too_long", { max: MAX_DOCUMENT_EXTRACT_CHARS }),
    });
    expect(JSON.stringify(tooLong.body)).not.toContain(SENTINEL);
    expect(JSON.stringify(tooLong.body)).not.toContain(extracted);
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("calls the injected transcriber once for a sparse PDF and does not echo the file", async () => {
    const supabase = createSupabaseMock();
    const readDocumentText = vi.fn(() =>
      Promise.resolve({ ok: true as const, needsPdfTranscript: true, totalPages: 2 }),
    );
    const transcribePdf = vi.fn(() => Promise.resolve({ ok: true as const, text: "Scanned line" }));
    const bytes = new TextEncoder().encode(`%PDF-1.4 ${SENTINEL}`);

    const result = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: fileRequest([{ name: "scan.pdf", bytes }]),
      readDocumentText,
      transcribePdf,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, text: "Scanned line" } });
    expect(transcribePdf).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("treats a whitespace PDF transcript as empty text and does not call supabase.from", async () => {
    const supabase = createSupabaseMock();
    const readDocumentText = vi.fn(() =>
      Promise.resolve({ ok: true as const, needsPdfTranscript: true, totalPages: 1 }),
    );
    const transcribePdf = vi.fn(() => Promise.resolve({ ok: true as const, text: " \n\t " }));
    const bytes = new TextEncoder().encode(`%PDF-1.4 ${SENTINEL}`);

    const result = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: fileRequest([{ name: "scan.pdf", bytes }]),
      readDocumentText,
      transcribePdf,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, message: t("en", "generator.error.document_no_text") });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(transcribePdf).toHaveBeenCalledTimes(1);
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("returns the model error key when PDF transcription fails and does not echo the file", async () => {
    const supabase = createSupabaseMock();
    const readDocumentText = vi.fn(() =>
      Promise.resolve({ ok: true as const, needsPdfTranscript: true, totalPages: 1 }),
    );
    const transcribePdf = vi.fn(() => Promise.resolve({ ok: false as const, errorKey: "generator.error.timeout" }));
    const bytes = new TextEncoder().encode(`%PDF-1.4 data:application/pdf;base64,${SENTINEL}`);

    const result = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: fileRequest([{ name: "scan.pdf", bytes }]),
      readDocumentText,
      transcribePdf,
    });

    expect(result).toEqual({ status: 502, body: { ok: false, errorKey: "generator.error.timeout" } });
    expect(JSON.stringify(result.body)).not.toContain(SENTINEL);
    expect(JSON.stringify(result.body)).not.toContain("data:application/pdf");
    expect(supabase.fromCalls).toHaveLength(0);
  });

  it("does not transcribe a password-protected PDF or a document over the page cap", async () => {
    const supabase = createSupabaseMock();
    const passwordReaders = readers({ ok: false, errorKey: "generator.error.document_password" });
    const password = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: fileRequest([{ name: "locked.pdf", bytes: new TextEncoder().encode("%PDF-locked") }]),
      ...passwordReaders,
    });

    expect(password.status).toBe(400);
    expect(password.body).toEqual({ ok: false, message: t("en", "generator.error.document_password") });
    expect(passwordReaders.transcribePdf).not.toHaveBeenCalled();

    const cappedReaders = readers({
      ok: true,
      needsPdfTranscript: true,
      totalPages: MAX_DOCUMENT_PAGES + 1,
    });
    const capped = await handleAiReadDocumentRequest({
      locale: "en",
      supabase,
      request: fileRequest([{ name: "long.pdf", bytes: new TextEncoder().encode("%PDF-long") }]),
      ...cappedReaders,
    });

    expect(capped.status).toBe(400);
    expect(capped.body).toEqual({
      ok: false,
      message: t("en", "generator.error.document_too_many_pages", { max: MAX_DOCUMENT_PAGES }),
    });
    expect(cappedReaders.transcribePdf).not.toHaveBeenCalled();
    expect(supabase.fromCalls).toHaveLength(0);
  });
});
