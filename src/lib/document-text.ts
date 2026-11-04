import { unzipSync, strFromU8 } from "fflate";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import WordExtractor from "word-extractor";
import { MAX_DOCUMENT_PAGES, PDF_PAGE_TEXT_MIN_CHARS } from "@/lib/ai-generation-limits";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] as const;
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0] as const;
const ZIP_MAGIC = [0x50, 0x4b] as const;

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "pptx"]);

export type DocumentKind = "pdf" | "doc" | "docx" | "pptx" | "txt";

export type DocumentReadErrorKey =
  | "generator.error.document_too_many_pages"
  | "generator.error.document_unsupported"
  | "generator.error.document_password"
  | "generator.error.document_no_text";

export type ReadDocumentTextResult =
  | { ok: true; text: string }
  | { ok: true; needsPdfTranscript: true; totalPages: number }
  | { ok: false; errorKey: DocumentReadErrorKey };

export function documentExtension(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return null;
  }

  const extension = base.slice(dot + 1).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

export function resolveDocumentKind(bytes: Uint8Array, extension: string): DocumentKind | null {
  const isPdf = startsWithBytes(bytes, PDF_MAGIC);
  const isOle = startsWithBytes(bytes, OLE_MAGIC);
  const isZip = startsWithBytes(bytes, ZIP_MAGIC);

  if (extension === "pdf") {
    return isPdf ? "pdf" : null;
  }

  if (extension === "docx") {
    return isZip ? "docx" : null;
  }

  if (extension === "pptx") {
    return isZip ? "pptx" : null;
  }

  if (extension === "doc") {
    if (isZip) {
      return "docx";
    }
    return isOle ? "doc" : null;
  }

  if (extension === "txt") {
    if (isPdf || isOle || isZip) {
      return null;
    }
    return "txt";
  }

  return null;
}

export async function readDocumentText(bytes: Uint8Array, kind: DocumentKind): Promise<ReadDocumentTextResult> {
  if (kind === "pdf") {
    return readPdf(bytes);
  }
  if (kind === "txt") {
    return readTxt(bytes);
  }
  if (kind === "docx") {
    return readDocx(bytes);
  }
  if (kind === "doc") {
    return readDoc(bytes);
  }
  return readPptx(bytes);
}

function startsWithBytes(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) {
    return false;
  }

  return magic.every((byte, index) => bytes[index] === byte);
}

function isPasswordProtectedPdfError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "PasswordException") {
    return true;
  }

  return error.cause instanceof Error && error.cause.name === "PasswordException";
}

async function readPdf(bytes: Uint8Array): Promise<ReadDocumentTextResult> {
  try {
    const extracted = await extractText(bytes, { mergePages: false });
    if (extracted.totalPages > MAX_DOCUMENT_PAGES) {
      return { ok: false, errorKey: "generator.error.document_too_many_pages" };
    }

    if (extracted.totalPages < 1) {
      return { ok: false, errorKey: "generator.error.document_unsupported" };
    }

    const pages = extracted.text.map((page) => page.trim());
    if (pages.some((page) => page.length < PDF_PAGE_TEXT_MIN_CHARS)) {
      return { ok: true, needsPdfTranscript: true, totalPages: extracted.totalPages };
    }

    const text = pages.join("\n\n").trim();
    if (!text) {
      return { ok: false, errorKey: "generator.error.document_no_text" };
    }

    return { ok: true, text };
  } catch (error) {
    if (isPasswordProtectedPdfError(error)) {
      return { ok: false, errorKey: "generator.error.document_password" };
    }

    return { ok: false, errorKey: "generator.error.document_unsupported" };
  }
}

function readTxt(bytes: Uint8Array): ReadDocumentTextResult {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    if (!text.trim()) {
      return { ok: false, errorKey: "generator.error.document_no_text" };
    }

    return { ok: true, text };
  } catch {
    return { ok: false, errorKey: "generator.error.document_unsupported" };
  }
}

async function readDocx(bytes: Uint8Array): Promise<ReadDocumentTextResult> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = result.value.trim();
    if (!text) {
      return { ok: false, errorKey: "generator.error.document_no_text" };
    }

    return { ok: true, text };
  } catch {
    return { ok: false, errorKey: "generator.error.document_unsupported" };
  }
}

async function readDoc(bytes: Uint8Array): Promise<ReadDocumentTextResult> {
  try {
    const extractor = new WordExtractor();
    const document = await extractor.extract(Buffer.from(bytes));
    const text = document.getBody().trim();
    if (!text) {
      return { ok: false, errorKey: "generator.error.document_no_text" };
    }

    return { ok: true, text };
  } catch {
    return { ok: false, errorKey: "generator.error.document_unsupported" };
  }
}

function readPptx(bytes: Uint8Array): ReadDocumentTextResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, errorKey: "generator.error.document_unsupported" };
  }

  const slidePaths = resolveSlidePaths(files);
  if (slidePaths === "corrupt") {
    return { ok: false, errorKey: "generator.error.document_unsupported" };
  }

  if (slidePaths.length > MAX_DOCUMENT_PAGES) {
    return { ok: false, errorKey: "generator.error.document_too_many_pages" };
  }

  const slides: string[] = [];
  for (const path of slidePaths) {
    const xmlBytes = zipEntry(files, path);
    if (!xmlBytes) {
      return { ok: false, errorKey: "generator.error.document_unsupported" };
    }
    slides.push(slidePlainText(strFromU8(xmlBytes)));
  }

  const text = slides.join("\n\n").trim();
  if (!text) {
    return { ok: false, errorKey: "generator.error.document_no_text" };
  }

  return { ok: true, text };
}

function resolveSlidePaths(files: Record<string, Uint8Array>): string[] | "corrupt" {
  const presentation = zipEntry(files, "ppt/presentation.xml");
  const rels = zipEntry(files, "ppt/_rels/presentation.xml.rels");
  if (!presentation || !rels) {
    return fallbackSlidePaths(files);
  }

  const presentationXml = strFromU8(presentation);
  const relsXml = strFromU8(rels);
  const ids = [...presentationXml.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
  const targets = new Map<string, string>();

  for (const tag of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const source = tag[0];
    const id = /\sId="([^"]+)"/.exec(source)?.[1];
    const target = /\sTarget="([^"]+)"/.exec(source)?.[1];
    if (id && target) {
      targets.set(id, target);
    }
  }

  const paths: string[] = [];
  for (const id of ids) {
    const target = targets.get(id);
    if (!target) {
      return "corrupt";
    }

    const normalized = target.replace(/\\/g, "/").replace(/^\//, "");
    if (normalized.includes("..")) {
      return "corrupt";
    }

    paths.push(normalized.startsWith("ppt/") ? normalized : `ppt/${normalized.replace(/^\.\//, "")}`);
  }

  return paths;
}

function fallbackSlidePaths(files: Record<string, Uint8Array>): string[] {
  return Object.keys(files)
    .map((name) => name.replace(/\\/g, "/"))
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => slideNumber(left) - slideNumber(right));
}

function slideNumber(path: string): number {
  const match = /slide(\d+)\.xml$/i.exec(path);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function zipEntry(files: Record<string, Uint8Array>, path: string): Uint8Array | undefined {
  if (Object.hasOwn(files, path)) {
    return files[path];
  }

  const target = path.toLowerCase();
  for (const [name, data] of Object.entries(files)) {
    if (name.replace(/\\/g, "/").toLowerCase() === target) {
      return data;
    }
  }

  return undefined;
}

function slidePlainText(xml: string): string {
  const paragraphs = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? [];
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const runs = [...paragraph.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)].flatMap((match) =>
      match[1] ? [decodeXml(match[1])] : [],
    );
    const line = runs.join("").trim();
    if (line) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => codePoint(Number.parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, dec: string) => codePoint(Number.parseInt(dec, 10), match))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function codePoint(code: number, fallback: string): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return fallback;
  }

  return String.fromCodePoint(code);
}
