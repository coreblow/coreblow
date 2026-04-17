/**
 * Phase 25 — Test 7: Phase 22 (Media Understanding)
 */
import { describe, it, expect } from "vitest";
import { normalizeRpcAttachmentsToChatAttachments } from "../../src/gateway/server-methods/chat-attachments.js";

describe("Phase 22: Media Understanding", () => {

    describe("Pipeline Runner", () => {
        it("runner module is importable", async () => {
            const mod = await import("../../src/media-understanding/runner.js");
            expect(mod).toBeDefined();
        });
    });

    describe("Document Parser", () => {
        it("document-parser is importable", async () => {
            const mod = await import("../../src/media-understanding/document-parser.js");
            expect(mod).toBeDefined();
        });
    });

    describe("Image Analyzer", () => {
        it("image module is importable", async () => {
            const mod = await import("../../src/media-understanding/image.js");
            expect(mod).toBeDefined();
        });
    });

    describe("Attachment Normalization (Gateway)", () => {
        it("normalizes image attachments correctly", () => {
            const result = normalizeRpcAttachmentsToChatAttachments([
                { mimeType: "image/png", fileName: "screenshot.png", content: "base64data" },
            ]);
            expect(result).toHaveLength(1);
            expect(result[0]!.type).toBe("image");
            expect(result[0]!.mimeType).toBe("image/png");
        });

        it("normalizes file attachments correctly", () => {
            const result = normalizeRpcAttachmentsToChatAttachments([
                { mimeType: "application/pdf", fileName: "doc.pdf", content: "pdfdata" },
            ]);
            expect(result).toHaveLength(1);
            expect(result[0]!.type).toBe("file");
        });

        it("handles undefined input gracefully", () => {
            const result = normalizeRpcAttachmentsToChatAttachments(undefined);
            expect(result).toEqual([]);
        });

        it("handles empty array", () => {
            const result = normalizeRpcAttachmentsToChatAttachments([]);
            expect(result).toEqual([]);
        });

        it("fills defaults for missing fields", () => {
            const result = normalizeRpcAttachmentsToChatAttachments([{}]);
            expect(result).toHaveLength(1);
            expect(result[0]!.mimeType).toBe("application/octet-stream");
            expect(result[0]!.fileName).toBe("unnamed");
        });
    });
});
