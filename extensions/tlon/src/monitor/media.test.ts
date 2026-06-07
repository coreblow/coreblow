import { describe, expect, it } from "vitest";
import { extractImageBlocks } from "./media.js";

describe("tlon media helpers", () => {
  it("extracts image blocks from message content", () => {
    expect(
      extractImageBlocks([
        { block: { image: { src: "https://example.test/image.png", alt: "image" } } },
        { block: { text: "ignored" } },
      ]),
    ).toEqual([{ url: "https://example.test/image.png", alt: "image" }]);
  });
});
