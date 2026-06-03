import { extractPdfContent } from "../../src/media/pdf-extract.js";

export type DocumentExtractedImage = {
  type: "image";
  data: string;
  mimeType: string;
};

export type DocumentExtractionRequest = {
  buffer: Buffer;
  mimeType: string;
  maxPages: number;
  maxPixels: number;
  minTextChars: number;
  pageNumbers?: number[];
  onImageExtractionError?: (error: unknown) => void;
};

export type DocumentExtractionResult = {
  text: string;
  images: DocumentExtractedImage[];
};

export type DocumentExtractorPlugin = {
  id: string;
  label: string;
  mimeTypes: string[];
  autoDetectOrder: number;
  extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult>;
};

export function createPdfDocumentExtractor(): DocumentExtractorPlugin {
  return {
    id: "pdf",
    label: "PDF",
    mimeTypes: ["application/pdf"],
    autoDetectOrder: 10,
    extract: extractPdfContent,
  };
}
