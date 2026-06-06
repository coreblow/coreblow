import { describe, expect, it } from "vitest";
import {
  resolveChannelContextVisibilityMode,
  resolveDefaultContextVisibility,
} from "./context-visibility.js";
import type { CoreBlowConfig } from "./types.js";

describe("context visibility config", () => {
  it("resolves the defaults section", () => {
    expect(
      resolveDefaultContextVisibility({
        channels: { defaults: { contextVisibility: "allowlist" } },
      }),
    ).toBe("allowlist");
  });

  it("prefers explicit configured mode", () => {
    expect(
      resolveChannelContextVisibilityMode({
        cfg: { channels: { discord: { contextVisibility: "allowlist" } } } as CoreBlowConfig,
        channel: "discord",
        configuredContextVisibility: "allowlist_quote",
      }),
    ).toBe("allowlist_quote");
  });

  it("prefers account mode before channel and global defaults", () => {
    expect(
      resolveChannelContextVisibilityMode({
        cfg: {
          channels: {
            defaults: { contextVisibility: "all" },
            discord: {
              contextVisibility: "allowlist",
              accounts: {
                work: { contextVisibility: "allowlist_quote" },
              },
            },
          },
        } as CoreBlowConfig,
        channel: "discord",
        accountId: "work",
      }),
    ).toBe("allowlist_quote");
  });

  it("falls back through channel, default, and all", () => {
    expect(
      resolveChannelContextVisibilityMode({
        cfg: { channels: { discord: { contextVisibility: "allowlist" } } } as CoreBlowConfig,
        channel: "discord",
      }),
    ).toBe("allowlist");
    expect(
      resolveChannelContextVisibilityMode({
        cfg: { channels: { defaults: { contextVisibility: "allowlist_quote" } } } as CoreBlowConfig,
        channel: "discord",
      }),
    ).toBe("allowlist_quote");
    expect(resolveChannelContextVisibilityMode({ cfg: {}, channel: "discord" })).toBe("all");
  });
});
