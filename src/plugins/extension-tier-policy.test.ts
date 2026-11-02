import { beforeEach, describe, expect, it } from "vitest";
import { ExtensionTierPolicy } from "./extension-tier-policy.js";

describe("ExtensionTierPolicy", () => {
  let policy: ExtensionTierPolicy;

  beforeEach(async () => {
    policy = new ExtensionTierPolicy();
    await policy.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(policy.health().status).toBe("healthy");
    await policy.stop();
    expect(policy.health().status).toBe("down");
  });

  it("correctly identifies Core tier extensions", () => {
    expect(policy.isCoreTier("telegram")).toBe(true);
    expect(policy.isCoreTier("whatsapp")).toBe(true);
    expect(policy.isCoreTier("extensions/slack")).toBe(true);
    expect(policy.isCoreTier("acp")).toBe(true);
    expect(policy.isCoreTier("memory-core")).toBe(true);
    expect(policy.isCoreTier("ollama")).toBe(true);
    expect(policy.isCoreTier("vllm")).toBe(true);
    expect(policy.getExtensionTier("telegram")).toBe("core");
    expect(policy.getExtensionTier("whatsapp")).toBe("core");
    expect(policy.getExtensionTier("slack")).toBe("core");
    expect(policy.getExtensionTier("acp")).toBe("core");
    expect(policy.getExtensionTier("memory-core")).toBe("core");
  });

  it("correctly identifies CoreHub on-demand extensions", () => {
    const externalizedCommunityChannels = [
      "discord",
      "matrix",
      "twitch",
      "feishu",
      "line",
      "zalo",
      "zalouser",
      "qqbot",
      "mattermost",
      "nextcloud-talk",
      "synology-chat",
      "tlon",
      "nostr",
      "irc",
      "msteams",
    ];

    for (const channelId of externalizedCommunityChannels) {
      expect(policy.isCoreHubOnDemand(channelId)).toBe(true);
      expect(policy.getExtensionTier(channelId)).toBe("corehub_on_demand");
    }

    expect(policy.isCoreHubOnDemand("bluesky")).toBe(true);
    expect(policy.isCoreHubOnDemand("diffs")).toBe(true);
  });

  it("partitions an arbitrary list of extensions into core and on-demand buckets", () => {
    const list = ["discord", "bluesky", "telegram", "msteams", "ollama"];
    const partitioned = policy.partitionExtensionList(list);

    expect(partitioned.core).toEqual(["telegram", "ollama"]);
    expect(partitioned.onDemand).toEqual(["discord", "bluesky", "msteams"]);
  });

  it("allows registering and overriding extension tiers dynamically", () => {
    policy.registerExtensionTier("custom-channel", "core");
    expect(policy.isCoreTier("custom-channel")).toBe(true);

    policy.registerExtensionTier("custom-channel", "corehub_on_demand");
    expect(policy.isCoreHubOnDemand("custom-channel")).toBe(true);
  });
});
