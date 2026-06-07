import { describe, expect, it } from "vitest";
import { resolveHostedZaloMediaRoutePrefix } from "./outbound-media.js";

describe("zalo outbound media", () => {
  it("derives media route prefixes", () => {
    expect(
      resolveHostedZaloMediaRoutePrefix({
        webhookUrl: "https://example.com/hooks/zalo",
      }),
    ).toBe("/hooks/zalo/media");
  });
});
