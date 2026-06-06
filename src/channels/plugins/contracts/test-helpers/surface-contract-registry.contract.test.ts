import { describe, expect, it } from "vitest";
import { getBundledChannelPluginAsync } from "./bundled-channel-plugin-loader.js";
import { channelPluginSurfaceKeys } from "./manifest.js";
import {
  getDirectoryContractRegistryShardRefs,
  getSurfaceContractRegistryShardIds,
  getThreadingContractRegistryShardRefs,
} from "./surface-contract-registry.js";
import { expectChannelSurfaceContract } from "./surface-contract-suite.js";

describe("channel surface contract registry helpers", () => {
  it("partitions bundled channel ids into deterministic surface shards", () => {
    const shardA = getSurfaceContractRegistryShardIds({ shardIndex: 0, shardCount: 2 });
    const shardB = getSurfaceContractRegistryShardIds({ shardIndex: 1, shardCount: 2 });

    expect(new Set([...shardA, ...shardB]).size).toBe(shardA.length + shardB.length);
    expect([...shardA, ...shardB].toSorted()).toEqual(
      getSurfaceContractRegistryShardIds({ shardIndex: 0, shardCount: 1 }).toSorted(),
    );
  });

  it("returns only bundled directory and threading refs", () => {
    const bundledIds = new Set(getSurfaceContractRegistryShardIds({ shardIndex: 0, shardCount: 1 }));
    const directoryRefs = getDirectoryContractRegistryShardRefs({
      shardIndex: 0,
      shardCount: 1,
    });
    const threadingRefs = getThreadingContractRegistryShardRefs({
      shardIndex: 0,
      shardCount: 1,
    });

    expect(directoryRefs.length).toBeGreaterThan(0);
    expect(threadingRefs.length).toBeGreaterThan(0);
    for (const ref of [...directoryRefs, ...threadingRefs]) {
      expect(bundledIds.has(ref.id)).toBe(true);
    }
  });

  it("validates declared surfaces for a bundled plugin", async () => {
    const plugin = await getBundledChannelPluginAsync("telegram");
    expect(plugin).toBeDefined();
    const surfaces = channelPluginSurfaceKeys.filter((surface) => Boolean(plugin?.[surface]));
    expect(surfaces.length).toBeGreaterThan(0);

    for (const surface of surfaces) {
      expectChannelSurfaceContract({
        plugin: plugin!,
        surface,
      });
    }
  });
});
