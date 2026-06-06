import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import {
  hasBundledChannelConfiguredState,
  listBundledChannelIdsWithConfiguredState,
} from "./configured-state.js";
import type { ChannelPackageStateCatalogEntry } from "./package-state-probes.js";

const cfg = {} as CoreBlowConfig;

const catalogEntries: ChannelPackageStateCatalogEntry[] = [
  {
    id: "alias-chat",
    pluginId: "vendor-alias-chat-plugin",
    channel: {
      id: "alias-chat",
      configuredState: {
        env: {
          anyOf: ["ALIAS_CHAT_TOKEN", "ALIAS_CHAT_SESSION"],
        },
      },
    },
  },
];

describe("bundled configured channel state", () => {
  it("lists and checks configured-state probes by channel id", () => {
    expect(listBundledChannelIdsWithConfiguredState(catalogEntries)).toEqual(["alias-chat"]);
    expect(
      hasBundledChannelConfiguredState({
        channelId: "alias-chat",
        cfg,
        env: { ALIAS_CHAT_SESSION: "session" },
        catalogEntries,
      }),
    ).toBe(true);
    expect(
      hasBundledChannelConfiguredState({
        channelId: "vendor-alias-chat-plugin",
        cfg,
        env: { ALIAS_CHAT_SESSION: "session" },
        catalogEntries,
      }),
    ).toBe(false);
  });
});
