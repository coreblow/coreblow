import { describe, expect, it } from "vitest";
import { nextcloudTalkMessageAdapter } from "./message-adapter.js";
import { requireRuntimeConfig } from "./send.runtime.js";

describe("nextcloud-talk send cfg threading", () => {
  it("declares durable final capabilities and requires resolved config", () => {
    expect(nextcloudTalkMessageAdapter.durableFinal.capabilities).toEqual({ text: true, media: true, replyTo: true });
    expect(() => requireRuntimeConfig(undefined, "Nextcloud Talk send")).toThrow("requires a resolved runtime config");
    expect(requireRuntimeConfig({ source: "provided" }, "send")).toEqual({ source: "provided" });
  });
});
