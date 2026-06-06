import { describe, expect, it } from "vitest";
import { listBundledChannelPluginIds } from "./bundled-channel-plugin-loader.js";
import {
  channelPluginSurfaceKeys,
  sessionBindingContractChannelIds,
} from "./manifest.js";
import { getPluginContractRegistryShardRefs } from "./registry-plugin.js";

describe("channel plugin contract test helpers", () => {
  it("re-exports the contract manifest from the helper surface", () => {
    expect([...channelPluginSurfaceKeys]).toContain("messaging");
    expect([...sessionBindingContractChannelIds]).toContain("telegram");
  });

  it("splits bundled channel plugins into deterministic shard refs", () => {
    const ids = [...listBundledChannelPluginIds()];
    const refs = [
      ...getPluginContractRegistryShardRefs({ shardIndex: 0, shardCount: 2 }),
      ...getPluginContractRegistryShardRefs({ shardIndex: 1, shardCount: 2 }),
    ];

    expect(refs.map((entry) => entry.id).toSorted()).toEqual(ids.toSorted());
  });
});
