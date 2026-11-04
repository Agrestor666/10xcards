import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, unzipSync, zipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_PAGES } from "@/lib/ai-generation-limits";
import { documentExtension, readDocumentText, resolveDocumentKind } from "@/lib/document-text";

const PAGE_ONE = "Alpha page has more than forty characters of study text.";
const PAGE_TWO = "Beta page has more than forty characters of study text.";
const SENTINEL = "E2E_DOCUMENT_READER_SENTINEL_xyzzy_42";

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`./test-fixtures/${name}`, import.meta.url)));
}

async function pdfWithPages(texts: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of texts) {
    const page = pdf.addPage();
    if (text) {
      page.drawText(text, { x: 50, y: 700, size: 12, font });
    }
  }

  return pdf.save();
}

function docxWithParagraphs(paragraphs: string[]): Uint8Array {
  const body = paragraphs
    .map((paragraph) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(paragraph)}</w:t></w:r></w:p>`)
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rels),
    "word/document.xml": strToU8(documentXml),
  });
}

function slideXml(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`;
}

/** Reading order follows the relationship list, which is the reverse of the slide filenames. */
function pptxWithReversedFilenames(textsInReadingOrder: string[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const slideIds: string[] = [];
  const relationships: string[] = [];

  textsInReadingOrder.forEach((text, index) => {
    const filenameIndex = textsInReadingOrder.length - index;
    const relationshipId = `rId${index + 1}`;
    files[`ppt/slides/slide${filenameIndex}.xml`] = strToU8(slideXml(escapeXml(text)));
    slideIds.push(`<p:sldId id="${256 + index}" r:id="${relationshipId}"/>`);
    relationships.push(
      `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${filenameIndex}.xml"/>`,
    );
  });

  files["ppt/presentation.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slideIds.join("")}</p:sldIdLst>
</p:presentation>`,
  );
  files["ppt/_rels/presentation.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`,
  );

  return zipSync(files);
}

function pptxWithSlideCount(count: number): Uint8Array {
  return pptxWithReversedFilenames(Array.from({ length: count }, (_, index) => `Slide ${index + 1} study notes`));
}

const OVER_UNCOMPRESSED_BUDGET = 40_000_000;

function withExtraZipEntry(zip: Uint8Array, name: string, contents: Uint8Array): Uint8Array {
  const files = unzipSync(zip);
  files[name] = contents;
  return zipSync(files);
}

function patchUncompressedSize(zip: Uint8Array, entryName: string, size: number): Uint8Array {
  const bytes = Uint8Array.from(zip);
  const name = new TextEncoder().encode(entryName);
  const sizeBytes = new Uint8Array(4);
  new DataView(sizeBytes.buffer).setUint32(0, size, true);
  let patched = 0;

  for (let index = 0; index <= bytes.length - name.length; index += 1) {
    if (!name.every((byte, offset) => bytes[index + offset] === byte)) {
      continue;
    }

    if (
      index >= 30 &&
      bytes[index - 30] === 0x50 &&
      bytes[index - 29] === 0x4b &&
      bytes[index - 28] === 0x03 &&
      bytes[index - 27] === 0x04
    ) {
      bytes.set(sizeBytes, index - 8);
      patched += 1;
    }

    if (
      index >= 46 &&
      bytes[index - 46] === 0x50 &&
      bytes[index - 45] === 0x4b &&
      bytes[index - 44] === 0x01 &&
      bytes[index - 43] === 0x02
    ) {
      bytes.set(sizeBytes, index - 22);
      patched += 1;
    }
  }

  if (patched < 2) {
    throw new Error(`could not patch ${entryName}`);
  }

  return bytes;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

describe("readDocumentText", () => {
  it("does not import renderPageAsImage or call OpenRouter", () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "document-text.ts");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("renderPageAsImage");
    expect(source.toLowerCase()).not.toContain("openrouter");
    expect(source).not.toContain("fetch(");
  });

  it("joins a fully textual PDF in page order and does not ask for a transcript", async () => {
    const result = await readDocumentText(await pdfWithPages([PAGE_ONE, PAGE_TWO]), "pdf");

    expect(result).toEqual({ ok: true, text: `${PAGE_ONE}\n\n${PAGE_TWO}` });
  });

  it("signals one model transcript when any page is under 40 characters and discards the text layer", async () => {
    const result = await readDocumentText(await pdfWithPages([PAGE_ONE, "Hi"]), "pdf");

    expect(result).toEqual({ ok: true, needsPdfTranscript: true, totalPages: 2 });
  });

  it("treats a trailing blank page as sparse", async () => {
    const result = await readDocumentText(await pdfWithPages([PAGE_ONE, ""]), "pdf");

    expect(result).toEqual({ ok: true, needsPdfTranscript: true, totalPages: 2 });
  });

  it("rejects a PDF over the page cap before a transcript signal", async () => {
    const texts = Array.from({ length: MAX_DOCUMENT_PAGES + 1 }, () => "");
    const result = await readDocumentText(await pdfWithPages(texts), "pdf");

    expect(result).toEqual({ ok: false, errorKey: "generator.error.document_too_many_pages" });
  });

  it("rejects a password-protected PDF without copying the library message", async () => {
    const bytes = fixture("password-protected.pdf");
    const result = await readDocumentText(bytes, "pdf");

    expect(result).toEqual({ ok: false, errorKey: "generator.error.document_password" });
    expect(JSON.stringify(result)).not.toContain("No password given");
  });

  it("rejects a corrupt PDF without echoing file bytes", async () => {
    const bytes = new TextEncoder().encode(`%PDF-1.7 ${SENTINEL}`);
    const result = await readDocumentText(bytes, "pdf");

    expect(result).toEqual({ ok: false, errorKey: "generator.error.document_unsupported" });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it("reads DOCX paragraphs and a zip renamed to .doc as DOCX", async () => {
    const bytes = docxWithParagraphs(["Alpha paragraph", "Beta paragraph"]);
    const result = await readDocumentText(bytes, "docx");

    expect(result.ok).toBe(true);
    if (result.ok && "text" in result) {
      expect(result.text.indexOf("Alpha paragraph")).toBeGreaterThanOrEqual(0);
      expect(result.text.indexOf("Beta paragraph")).toBeGreaterThan(result.text.indexOf("Alpha paragraph"));
    }
    expect(resolveDocumentKind(bytes, "doc")).toBe("docx");
  });

  it("reads a legacy DOC buffer", async () => {
    const bytes = fixture("legacy-note.doc");

    expect(resolveDocumentKind(bytes, "doc")).toBe("doc");
    const result = await readDocumentText(bytes, "doc");

    expect(result.ok).toBe(true);
    if (result.ok && "text" in result) {
      expect(result.text).toContain("This is a test for parsing the Word file in node.");
    }
  });

  it("rejects a DOCX whose declared uncompressed size exceeds the budget", async () => {
    const bytes = patchUncompressedSize(
      docxWithParagraphs(["Alpha paragraph"]),
      "word/document.xml",
      OVER_UNCOMPRESSED_BUDGET,
    );
    const result = await readDocumentText(bytes, "docx");

    expect(result).toEqual({ ok: false, errorKey: "generator.error.document_unsupported" });
  });

  it("reads PPTX text while skipping a media entry that declares an over-budget size", async () => {
    const bytes = patchUncompressedSize(
      withExtraZipEntry(
        pptxWithReversedFilenames(["ALPHA & one", "BETA slide notes"]),
        "ppt/media/image1.png",
        strToU8("not-a-real-image"),
      ),
      "ppt/media/image1.png",
      OVER_UNCOMPRESSED_BUDGET,
    );
    const result = await readDocumentText(bytes, "pptx");

    expect(result).toEqual({ ok: true, text: "ALPHA & one\n\nBETA slide notes" });

    const oversizedSlide = patchUncompressedSize(
      pptxWithReversedFilenames(["ALPHA & one"]),
      "ppt/slides/slide1.xml",
      OVER_UNCOMPRESSED_BUDGET,
    );
    await expect(readDocumentText(oversizedSlide, "pptx")).resolves.toEqual({
      ok: false,
      errorKey: "generator.error.document_unsupported",
    });
  });

  it("reads PPTX slide text in relationship order and rejects more than 20 slides", async () => {
    const ordered = await readDocumentText(pptxWithReversedFilenames(["ALPHA & one", "BETA slide notes"]), "pptx");

    expect(ordered).toEqual({ ok: true, text: "ALPHA & one\n\nBETA slide notes" });

    const tooMany = await readDocumentText(pptxWithSlideCount(MAX_DOCUMENT_PAGES + 1), "pptx");
    expect(tooMany).toEqual({ ok: false, errorKey: "generator.error.document_too_many_pages" });
  });

  it("decodes UTF-8 text, strips a BOM, and rejects non-UTF-8 or empty text", async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Notes line")]);
    await expect(readDocumentText(withBom, "txt")).resolves.toEqual({ ok: true, text: "Notes line" });
    await expect(readDocumentText(new TextEncoder().encode("   \n"), "txt")).resolves.toEqual({
      ok: false,
      errorKey: "generator.error.document_no_text",
    });
    await expect(readDocumentText(Uint8Array.from([0xff, 0xfe, 0x41, 0x00]), "txt")).resolves.toEqual({
      ok: false,
      errorKey: "generator.error.document_unsupported",
    });
  });

  it("sniffs magic bytes and lets the extension choose only between DOCX and PPTX", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4");
    const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
    const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0x00]);
    const text = new TextEncoder().encode("plain notes");

    expect(documentExtension("Notes.PDF")).toBe("pdf");
    expect(documentExtension("image.png")).toBeNull();
    expect(resolveDocumentKind(pdf, "pdf")).toBe("pdf");
    expect(resolveDocumentKind(zip, "pdf")).toBeNull();
    expect(resolveDocumentKind(pdf, "txt")).toBeNull();
    expect(resolveDocumentKind(text, "txt")).toBe("txt");
    expect(resolveDocumentKind(ole, "doc")).toBe("doc");
    expect(resolveDocumentKind(zip, "docx")).toBe("docx");
    expect(resolveDocumentKind(zip, "pptx")).toBe("pptx");
    expect(resolveDocumentKind(ole, "pptx")).toBeNull();
  });
});
