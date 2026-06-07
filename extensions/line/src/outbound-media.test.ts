import { describe, expect, it } from "vitest";
import { resolveLineOutboundMedia } from "./outbound-media.js";

describe("line outbound media", () => {
  it("resolves image media by default", async () => {
    await expect(resolveLineOutboundMedia("https://example.com/a.png")).resolves.toMatchObject({
      mediaKind: "image",
      mediaUrl: "https://example.com/a.png",
    });
  });
});
