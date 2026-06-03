import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/media/pdf-extract.js", () => ({
  extractPdfContent: vi.fn(async () => ({
    text: "Extracted text",
    images: [],
  })),
}));

import { extractPdfContent } from "../../src/media/pdf-extract.js";
import { createPdfDocumentExtractor } from "./document-extractor.js";

describe("PDF document extractor", () => {
  it("declares PDF support", () => {
    const extractor = createPdfDocumentExtractor();
    const { extract, ...descriptor } = extractor;
    expect(extract).toBe(extractPdfContent);
    expect(descriptor).toEqual({
      id: "pdf",
      label: "PDF",
      mimeTypes: ["application/pdf"],
      autoDetectOrder: 10,
    });
  });

  it("forwards extraction requests to the shared PDF runtime", async () => {
    const extractor = createPdfDocumentExtractor();
    const request = {
      buffer: Buffer.from("%PDF-1.4"),
      mimeType: "application/pdf",
      maxPages: 2,
      maxPixels: 100,
      minTextChars: 10,
      pageNumbers: [1],
    };

    const result = await extractor.extract(request);

    expect(extractPdfContent).toHaveBeenCalledWith(request);
    expect(result).toEqual({
      text: "Extracted text",
      images: [],
    });
  });
});
