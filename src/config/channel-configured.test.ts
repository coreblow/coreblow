import { describe, expect, it } from "vitest";
import { isChannelConfigured } from "./channel-configured.js";
import type { CoreBlowConfig } from "./config.js";

function makeConfig(channels: Record<string, unknown> = {}): CoreBlowConfig {
  return { channels } as CoreBlowConfig;
}

describe("isChannelConfigured", () => {
  it("returns false for empty config", () => {
    expect(isChannelConfigured(makeConfig(), "telegram")).toBe(false);
  });

  it("returns false when channel key absent", () => {
    expect(isChannelConfigured(makeConfig({ discord: {} }), "telegram")).toBe(false);
  });

  it("returns false when channel entry is empty object", () => {
    expect(isChannelConfigured(makeConfig({ telegram: {} }), "telegram")).toBe(false);
  });

  it("does not throw for any channel id", () => {
    const channels = ["telegram", "discord", "slack", "matrix", "whatsapp"];
    for (const ch of channels) {
      expect(() => isChannelConfigured(makeConfig(), ch)).not.toThrow();
    }
  });

  it("returns boolean for any config", () => {
    const result = isChannelConfigured(makeConfig({ discord: { token: "abc" } }), "discord");
    expect(typeof result).toBe("boolean");
  });
});
