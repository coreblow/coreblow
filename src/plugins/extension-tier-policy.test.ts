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
    expect(policy.isCoreTier("discord")).toBe(true);
    expect(policy.isCoreTier("telegram")).toBe(true);
    expect(policy.isCoreTier("whatsapp")).toBe(true);
    expect(policy.isCoreTier("extensions/slack")).toBe(true);
    expect(policy.isCoreTier("ollama")).toBe(true);
    expect(policy.isCoreTier("vllm")).toBe(true);
    expect(policy.getExtensionTier("discord")).toBe("core");
  });

  it("correctly identifies CoreHub on-demand extensions", () => {
    expect(policy.isCoreHubOnDemand("bluesky")).toBe(true);
    expect(policy.isCoreHubOnDemand("feishu")).toBe(true);
    expect(policy.isCoreHubOnDemand("msteams")).toBe(true);
    expect(policy.isCoreHubOnDemand("diffs")).toBe(true);
    expect(policy.getExtensionTier("bluesky")).toBe("corehub_on_demand");
  });

  it("partitions an arbitrary list of extensions into core and on-demand buckets", () => {
    const list = ["discord", "bluesky", "telegram", "msteams", "ollama"];
    const partitioned = policy.partitionExtensionList(list);

    expect(partitioned.core).toEqual(["discord", "telegram", "ollama"]);
    expect(partitioned.onDemand).toEqual(["bluesky", "msteams"]);
  });

  it("allows registering and overriding extension tiers dynamically", () => {
    policy.registerExtensionTier("custom-channel", "core");
    expect(policy.isCoreTier("custom-channel")).toBe(true);

    policy.registerExtensionTier("custom-channel", "corehub_on_demand");
    expect(policy.isCoreHubOnDemand("custom-channel")).toBe(true);
  });
});
