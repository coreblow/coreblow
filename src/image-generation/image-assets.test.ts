import { describe, expect, it } from "vitest";
import {
  generatedImageAssetFromDataUrl,
  imageFileExtensionForMimeType,
  imageSourceUploadFileName,
  parseImageDataUrl,
  parseOpenAiCompatibleImageResponse,
  sniffImageMimeType,
  toImageDataUrl,
} from "./image-assets.js";

describe("image asset helpers", () => {
  it("converts buffers to image data URLs and parses them back", () => {
    const buffer = Buffer.from("png-bytes");
    const dataUrl = toImageDataUrl({ buffer, mimeType: "image/png" });

    expect(parseImageDataUrl(dataUrl)).toEqual({
      mimeType: "image/png",
      base64: buffer.toString("base64"),
    });
    const asset = generatedImageAssetFromDataUrl({ dataUrl, index: 1 });
    expect(asset?.buffer).toEqual(buffer);
    expect(asset?.fileName).toBe("image-2.png");
  });

  it("normalizes and sniffs image types", () => {
    expect(imageFileExtensionForMimeType("image/jpeg")).toBe("jpg");
    expect(imageFileExtensionForMimeType("image/svg+xml")).toBe("svg");
    expect(sniffImageMimeType(Buffer.from([0xff, 0xd8, 0xff]))).toEqual({
      mimeType: "image/jpeg",
      extension: "jpg",
    });
  });

  it("parses OpenAI-compatible base64 image responses", () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    const images = parseOpenAiCompatibleImageResponse(
      {
        data: [{ b64_json: jpegBytes.toString("base64"), revised_prompt: "revised" }],
      },
      { defaultMimeType: "image/png", sniffMimeType: true },
    );

    expect(images).toEqual([
      {
        buffer: jpegBytes,
        mimeType: "image/jpeg",
        fileName: "image-1.jpg",
        revisedPrompt: "revised",
      },
    ]);
  });

  it("rejects malformed image responses in strict mode", () => {
    expect(() =>
      parseOpenAiCompatibleImageResponse(
        { data: [{ b64_json: "not-base64!" }] },
        { malformedResponseError: "Image response malformed" },
      ),
    ).toThrow("Image response malformed");
  });

  it("resolves source upload filenames from explicit names or MIME types", () => {
    expect(
      imageSourceUploadFileName({
        image: { buffer: Buffer.from("x"), mimeType: "image/webp" },
        index: 2,
      }),
    ).toBe("image-3.webp");
    expect(
      imageSourceUploadFileName({
        image: { buffer: Buffer.from("x"), mimeType: "image/png", fileName: "source.png" },
        index: 0,
      }),
    ).toBe("source.png");
  });
});
