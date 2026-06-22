import { describe, expect, it } from "vitest";
import { nextcloudTalkPlugin } from "./channel.js";

describe("nextcloud-talk channel status", () => {
  it("turns a missing response feature into a config issue", () => {
    expect(nextcloudTalkPlugin.status?.collectStatusIssues?.([{ accountId: "default", configured: true, probe: { ok: false, code: "missing_response_feature", message: "Response feature missing." } }])).toEqual([
      { channel: "nextcloud-talk", accountId: "default", kind: "config", message: "Response feature missing.", fix: "Add --feature response to the Talk bot." },
    ]);
  });
});
