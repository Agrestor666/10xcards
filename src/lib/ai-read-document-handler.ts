import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_EXTRACT_CHARS, MAX_DOCUMENT_PAGES } from "@/lib/ai-generation-limits";
import {
  documentExtension,
  resolveDocumentKind,
  type DocumentKind,
  type ReadDocumentTextResult,
} from "@/lib/document-text";
import type { AiGenerateHandlerSupabase } from "@/lib/ai-generate-handler";
import { supabaseNotConfiguredMessage } from "@/lib/flashcard-set-errors";
import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

const MAX_DOCUMENT_MEGABYTES = MAX_DOCUMENT_BYTES / (1024 * 1024);

export interface HandleAiReadDocumentRequestInput {
  locale: AppLocale;
  supabase: AiGenerateHandlerSupabase | null;
  request: Request;
  readDocumentText: (bytes: Uint8Array, kind: DocumentKind) => Promise<ReadDocumentTextResult>;
  transcribePdf: (bytes: Uint8Array) => Promise<{ ok: true; text: string } | { ok: false; errorKey: string }>;
}

export interface HandleAiReadDocumentRequestResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleAiReadDocumentRequest(
  input: HandleAiReadDocumentRequestInput,
): Promise<HandleAiReadDocumentRequestResult> {
  const { locale, supabase, request, readDocumentText, transcribePdf } = input;

  if (!supabase) {
    return { status: 503, body: { ok: false, message: supabaseNotConfiguredMessage(locale) } };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: 401, body: { ok: false, message: t(locale, "api.error.sign_in_generate") } };
  }

  const file = await readSingleFile(request);
  if (!file) {
    return { status: 400, body: { ok: false, message: t(locale, "api.error.invalid_body") } };
  }

  const extension = documentExtension(file.name);
  if (!extension) {
    return unsupported(locale);
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return tooLarge(locale);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    return tooLarge(locale);
  }

  const kind = resolveDocumentKind(bytes, extension);
  if (!kind) {
    return unsupported(locale);
  }

  let read: ReadDocumentTextResult;
  try {
    read = await readDocumentText(bytes, kind);
  } catch {
    return unsupported(locale);
  }

  if (!read.ok) {
    return readerFailure(locale, read.errorKey);
  }

  if ("needsPdfTranscript" in read) {
    if (!Number.isInteger(read.totalPages) || read.totalPages < 1) {
      return unsupported(locale);
    }

    if (read.totalPages > MAX_DOCUMENT_PAGES) {
      return tooManyPages(locale);
    }

    let transcript: { ok: true; text: string } | { ok: false; errorKey: string };
    try {
      transcript = await transcribePdf(bytes);
    } catch {
      return { status: 502, body: { ok: false, errorKey: "generator.error.generate" } };
    }

    if (!transcript.ok) {
      return { status: 502, body: { ok: false, errorKey: transcript.errorKey } };
    }

    return textResponse(locale, transcript.text);
  }

  return textResponse(locale, read.text);
}

async function readSingleFile(request: Request): Promise<File | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return null;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return null;
  }

  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      continue;
    }

    if (key !== "file" || !(value instanceof File)) {
      return null;
    }

    files.push(value);
  }

  if (files.length !== 1) {
    return null;
  }

  return files[0] ?? null;
}

function textResponse(locale: AppLocale, text: string): HandleAiReadDocumentRequestResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: 400, body: { ok: false, message: t(locale, "generator.error.document_no_text") } };
  }

  if (trimmed.length > MAX_DOCUMENT_EXTRACT_CHARS) {
    return {
      status: 400,
      body: {
        ok: false,
        message: t(locale, "generator.error.document_too_long", { max: MAX_DOCUMENT_EXTRACT_CHARS }),
      },
    };
  }

  return { status: 200, body: { ok: true, text: trimmed } };
}

function tooLarge(locale: AppLocale): HandleAiReadDocumentRequestResult {
  return {
    status: 400,
    body: {
      ok: false,
      message: t(locale, "generator.error.document_too_large", { max: MAX_DOCUMENT_MEGABYTES }),
    },
  };
}

function tooManyPages(locale: AppLocale): HandleAiReadDocumentRequestResult {
  return {
    status: 400,
    body: {
      ok: false,
      message: t(locale, "generator.error.document_too_many_pages", { max: MAX_DOCUMENT_PAGES }),
    },
  };
}

function unsupported(locale: AppLocale): HandleAiReadDocumentRequestResult {
  return { status: 400, body: { ok: false, message: t(locale, "generator.error.document_unsupported") } };
}

function readerFailure(
  locale: AppLocale,
  errorKey: ReadDocumentTextResult extends { ok: false; errorKey: infer Key } ? Key : never,
): HandleAiReadDocumentRequestResult {
  if (errorKey === "generator.error.document_too_many_pages") {
    return tooManyPages(locale);
  }

  return { status: 400, body: { ok: false, message: t(locale, errorKey) } };
}
