import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { inspectChannelAccount, resolveInspectedChannelAccount } from "./account-inspection.js";
import type { ChannelPlugin } from "./plugins/types.plugin.js";

const cfg = {} as CoreBlowConfig;

function createPlugin(params: {
  inspectAccount?: ChannelPlugin["config"]["inspectAccount"];
  resolvedAccount?: unknown;
  isConfigured?: ChannelPlugin["config"]["isConfigured"];
}): ChannelPlugin {
  return {
    id: "telegram",
    meta: {
      id: "telegram",
      label: "Telegram",
      selectionLabel: "Telegram",
      docsPath: "/channels/telegram",
      blurb: "",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: () => params.resolvedAccount ?? { enabled: true, configured: true },
      ...(params.inspectAccount ? { inspectAccount: params.inspectAccount } : {}),
      ...(params.isConfigured ? { isConfigured: params.isConfigured } : {}),
    },
  } as ChannelPlugin;
}

describe("account inspection", () => {
  it("prefers plugin inspection over read-only fallback", async () => {
    const inspected = { enabled: false, configured: true, name: "Work" };
    await expect(
      inspectChannelAccount({
        plugin: createPlugin({ inspectAccount: () => inspected }),
        cfg,
        accountId: "default",
      }),
    ).resolves.toBe(inspected);
  });

  it("preserves configured unavailable source accounts when resolved credentials are missing", async () => {
    const source = {
      enabled: true,
      configured: true,
      tokenStatus: "configured_unavailable",
    };
    const resolved = {
      enabled: true,
      configured: false,
      tokenStatus: "missing",
    };
    const plugin = createPlugin({
      inspectAccount: (inputCfg) => (inputCfg === cfg ? resolved : source),
      resolvedAccount: resolved,
    });

    await expect(
      resolveInspectedChannelAccount({
        plugin,
        cfg,
        sourceConfig: { ...cfg },
        accountId: "default",
      }),
    ).resolves.toEqual({
      account: source,
      enabled: true,
      configured: true,
    });
  });
});
