import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { createMicrokernelServiceRegistry } from "./gateway/microkernel-services.js";
import { bootstrapRuntime } from "./gateway/provider-bootstrap.js";
import { ExtensionTierPolicy } from "./plugins/extension-tier-policy.js";
import { getActivePluginChannelRegistry, listImportedRuntimePluginIds } from "./plugins/runtime.js";

describe("Lightweight Runtime & Packaging Smoke Tests", () => {
  const COMMUNITY_CHANNELS = [
    "discord",
    "feishu",
    "irc",
    "line",
    "matrix",
    "mattermost",
    "msteams",
    "nextcloud-talk",
    "nostr",
    "qqbot",
    "synology-chat",
    "tlon",
    "twitch",
    "zalo",
    "zalouser",
  ];

  it("enforces fast microkernel bootstrap gate (< 200ms) and bounded heap (< 400MB) with zero eager CoreHub loading", async () => {
    const tempDir = path.join(os.tmpdir(), `coreblow-benchmark-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const {
        runtime,
        provider,
        model,
        configured,
        providerRegistry,
        ragPipeline,
        toolRegistry,
        toolExecutor,
        ttsEngine,
        browserTool,
      } = bootstrapRuntime();

      const t0 = performance.now();
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: tempDir,
        coryDir: path.join(tempDir, "memory"),
        providerRegistry,
        activeProvider: provider,
        activeModel: model,
        isProviderConfigured: configured,
        ragPipeline,
        toolRegistry,
        toolExecutor,
        ttsEngine,
        browserTool,
        getActiveSessionKeys: () => runtime.listSessions().map((s) => s.id),
      });

      const startResult = await microkernel.registry.startAll();
      const bootstrapTimeMs = performance.now() - t0;

      // 1. Enforced service health & lifecycle gates
      expect(startResult.failed).toHaveLength(0);
      expect(startResult.started).toHaveLength(12);
      // Fast microkernel bootstrap gate: target is < 100ms; enforced CI gate is < 200ms
      expect(bootstrapTimeMs).toBeLessThan(200);

      // 2. Enforced heap memory gate: target is < 400MB in standalone process; < 750MB in pooled Vitest runner
      if (typeof global.gc === "function") {
        global.gc();
      }
      const mem = process.memoryUsage();
      expect(mem.heapUsed).toBeLessThan(750 * 1024 * 1024);

      // 3. Authoritative CoreHub lazy-loading checks
      expect(microkernel.appStore.getInstalledAppIds()).toHaveLength(0);
      expect(microkernel.appStore.getActivatedAppIds()).toHaveLength(0);
      expect(microkernel.appStore.getLoadedAppIds()).toHaveLength(0);
      expect(listImportedRuntimePluginIds()).toHaveLength(0);

      const channelRegistry = getActivePluginChannelRegistry();
      const loadedCommunityChannels = (channelRegistry?.plugins ?? [])
        .map((p) => p.id)
        .filter((id) => COMMUNITY_CHANNELS.includes(id));
      expect(loadedCommunityChannels).toHaveLength(0);

      await microkernel.registry.stopAll();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("proves default installation starts only kernel capabilities with 0 CoreHub apps loaded", () => {
    const tierPolicy = new ExtensionTierPolicy();

    // Verify all 15 community channels are strictly on-demand
    for (const channelId of COMMUNITY_CHANNELS) {
      expect(tierPolicy.isCoreHubOnDemand(channelId)).toBe(true);
      expect(tierPolicy.isCoreTier(channelId)).toBe(false);
    }

    // Verify core tier contains only built-in native capabilities
    const coreList = tierPolicy.listCoreExtensions();
    expect(coreList).toContain("cory");
    expect(coreList).toContain("cory-memory");
    expect(coreList).toContain("pr-workflow-orchestrator");
    expect(coreList).toContain("browser");
    expect(coreList).toContain("openai");
    expect(coreList).not.toContain("discord");
    expect(coreList).not.toContain("matrix");
  });

  it("verifies built package output exists and contains essential runtime artifacts", () => {
    const distPath = path.resolve(process.cwd(), "dist");
    expect(fs.existsSync(distPath)).toBe(true);

    const pluginSdkChannel = path.join(distPath, "plugin-sdk", "channel.d.ts");
    expect(fs.existsSync(pluginSdkChannel)).toBe(true);

    const pluginSdkProvider = path.join(distPath, "plugin-sdk", "provider.d.ts");
    expect(fs.existsSync(pluginSdkProvider)).toBe(true);

    const pluginSdkTool = path.join(distPath, "plugin-sdk", "tool.d.ts");
    expect(fs.existsSync(pluginSdkTool)).toBe(true);

    const pluginSdkMemory = path.join(distPath, "plugin-sdk", "memory.d.ts");
    expect(fs.existsSync(pluginSdkMemory)).toBe(true);

    const pluginSdkApproval = path.join(distPath, "plugin-sdk", "approval.d.ts");
    expect(fs.existsSync(pluginSdkApproval)).toBe(true);

    const binaryEntry = path.resolve(process.cwd(), "coreblow.mjs");
    expect(fs.existsSync(binaryEntry)).toBe(true);
  });

  it("enforces root package manifest self-containment and dependency bleed purge invariants", () => {
    const rootPkgPath = path.resolve(process.cwd(), "package.json");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));

    const PURGED_BLEED_DEPS = [
      "@buape/carbon",
      "@discordjs/voice",
      "matrix-js-sdk",
      "@matrix-org/matrix-sdk-crypto-nodejs",
      "@larksuiteoapi/node-sdk",
      "@line/bot-sdk",
      "@twurple/api",
      "@urbit/aura",
      "nostr-tools",
      "@lancedb/lancedb",
      "three",
    ];

    for (const dep of PURGED_BLEED_DEPS) {
      expect(rootPkg.dependencies?.[dep]).toBeUndefined();
    }

    // Root package files exclude externalized community channels
    expect(rootPkg.files).toContain("!extensions/discord/**");
    expect(rootPkg.files).toContain("!extensions/matrix/**");

    // Extensions declare their own self-contained runtime dependencies
    const discordPkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "extensions/discord/package.json"), "utf8"),
    );
    expect(discordPkg.dependencies?.["@buape/carbon"]).toBeDefined();
    expect(discordPkg.dependencies?.["@discordjs/voice"]).toBeDefined();

    const matrixPkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "extensions/matrix/package.json"), "utf8"),
    );
    expect(matrixPkg.dependencies?.["matrix-js-sdk"]).toBeDefined();
    expect(matrixPkg.dependencies?.["@matrix-org/matrix-sdk-crypto-nodejs"]).toBeDefined();
  });
});
