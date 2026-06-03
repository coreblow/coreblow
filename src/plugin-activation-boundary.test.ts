import { beforeEach, describe, expect, it, vi } from "vitest";

const loadPluginManifestRegistry = vi.hoisted(() => vi.fn(() => ({ diagnostics: [], plugins: [] })));

vi.mock("./plugins/manifest-registry.js", () => ({
  loadPluginManifestRegistry,
}));

describe("plugin activation boundary", () => {
  beforeEach(() => {
    loadPluginManifestRegistry.mockClear();
  });

  it("keeps static channel/model helpers cold and allows narrow browser helpers on demand", async () => {
    const { isChannelConfigured } = await import("./config/channel-configured.js");
    const { normalizeModelRef } = await import("./agents/model-selection.js");

    expect(isChannelConfigured({} as never, "telegram", { TELEGRAM_BOT_TOKEN: "token" })).toBe(
      true,
    );
    expect(isChannelConfigured({} as never, "discord", { DISCORD_BOT_TOKEN: "token" })).toBe(
      true,
    );
    expect(
      isChannelConfigured({} as never, "slack", { SLACK_BOT_TOKEN: "xoxb-test" }),
    ).toBe(true);
    expect(
      isChannelConfigured({} as never, "irc", {
        IRC_HOST: "irc.example.com",
        IRC_NICK: "coreblow",
      }),
    ).toBe(true);
    expect(isChannelConfigured({} as never, "whatsapp", {})).toBe(false);

    const staticNormalize = { allowPluginNormalization: false };
    expect(normalizeModelRef("google", "gemini-3.1-pro", staticNormalize)).toEqual({
      provider: "google",
      model: "gemini-3.1-pro",
    });
    expect(normalizeModelRef("google", "gemini-3-pro-preview", staticNormalize)).toEqual({
      provider: "google",
      model: "gemini-3-pro-preview",
    });
    expect(normalizeModelRef("xai", "grok-4-fast-reasoning", staticNormalize)).toEqual({
      provider: "xai",
      model: "grok-4-fast-reasoning",
    });

    expect(loadPluginManifestRegistry).not.toHaveBeenCalled();

    const { parseBrowserMajorVersion } = await import(
      "../extensions/browser/src/browser/chrome.executables.ts"
    );
    expect(parseBrowserMajorVersion("Google Chrome 144.0.7534.0")).toBe(144);

    expect(loadPluginManifestRegistry).not.toHaveBeenCalled();
  });
});
