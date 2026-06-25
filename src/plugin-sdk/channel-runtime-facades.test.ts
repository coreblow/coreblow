import { describe, expect, it } from "vitest";
import { mergeInboundPathRoots } from "./channel-inbound-roots.js";
import { formatLocationText } from "./channel-location.js";
import { resolveMentionGating } from "./channel-mention-gating.js";

describe("channel runtime facades", () => {
  it("merges normalized inbound roots", () => {
    expect(mergeInboundPathRoots(["/tmp/media"], ["/tmp/media", "/tmp/uploads"])).toEqual([
      "/tmp/media",
      "/tmp/uploads",
    ]);
  });

  it("keeps location and mention helpers callable", () => {
    expect(formatLocationText).toBeTypeOf("function");
    expect(resolveMentionGating).toBeTypeOf("function");
  });
});
