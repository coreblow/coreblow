import { describe, expect, it } from "vitest";
import { nextcloudTalkPlugin } from "./channel.js";

describe("nextcloud-talk channel contract", () => {
  it("publishes the expected channel capabilities", () => {
    expect(nextcloudTalkPlugin.id).toBe("nextcloud-talk");
    expect(nextcloudTalkPlugin.capabilities).toMatchObject({ media: true, reactions: true, threads: false });
  });
});
