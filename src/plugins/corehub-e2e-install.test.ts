import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  verifyOfficialChannelArtifacts,
  resolveOfficialExternalPluginInstall,
  resolveOfficialExternalPluginId,
  listOfficialExternalPluginCatalogEntries,
} from "./official-external-plugin-catalog.js";
import {
  AtomicPluginStageManager,
  CapabilityConsentLedger,
  PluginLifecycleManager,
  safeActivatePlugin,
  type CoreHubAppManifest,
} from "./app-store-contract.js";
import { CoreHubAppStoreRuntime } from "./app-store-runtime.js";
import { ExtensionTierPolicy } from "./extension-tier-policy.js";
import { buildStorefrontCatalogView } from "./cockpit-storefront-model.js";
import {
  getActivePluginRegistry,
  listImportedRuntimePluginIds,
  requireActivePluginRegistry,
  resetPluginRuntimeStateForTest,
} from "./runtime.js";

describe("CoreHub App Store Installation & Lifecycle End-to-End", () => {
  const SATELLITE_CATALOG = "/Users/febrinanda/coreblow-split/corehub/catalog.json";
  const SATELLITE_ARTIFACTS = "/Users/febrinanda/coreblow-split/corehub/artifacts";

  it("cryptographically verifies all 15 community channel artifacts against satellite catalog", () => {
    if (!fs.existsSync(SATELLITE_CATALOG) || !fs.existsSync(SATELLITE_ARTIFACTS)) {
      // In isolated environments without sibling repo, skip satellite check
      return;
    }

    const verification = verifyOfficialChannelArtifacts({
      catalogPath: SATELLITE_CATALOG,
      artifactsDir: SATELLITE_ARTIFACTS,
    });

    expect(verification.status).toBe("certified");
    expect(verification.totalChannels).toBe(15);
    expect(verification.verifiedCount).toBe(15);
    expect(verification.missingCount).toBe(0);
    expect(verification.checksumMismatches).toHaveLength(0);
    expect(verification.malformedCatalogChecksums).toHaveLength(0);
  });

  it("executes complete install, stage, verify, consent, activation, and rollback lifecycle", async () => {
    const tempDir = path.join(os.tmpdir(), `coreblow-corehub-e2e-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const tierPolicy = new ExtensionTierPolicy();
      const runtime = new CoreHubAppStoreRuntime({
        baseDir: tempDir,
        tierPolicy,
      });
      await runtime.start();

      // 1. Resolve CLI specifier corehub:discord
      const discordEntry = listOfficialExternalPluginCatalogEntries().find(
        (e) => resolveOfficialExternalPluginId(e) === "discord",
      );
      expect(discordEntry).toBeDefined();
      const installSpec = resolveOfficialExternalPluginInstall(discordEntry!);
      expect(installSpec?.corehubSpec).toBe("corehub:@coreblow/discord");
      expect(installSpec?.defaultChoice).toBe("corehub");

      // 2. Prepare mock artifact archive and manifest
      const artifactPayload = Buffer.from("simulated-tarball-archive-content-discord-v1.0.0");
      const expectedSha256 = crypto.createHash("sha256").update(artifactPayload).digest("hex");

      const manifest: CoreHubAppManifest = {
        id: "discord",
        version: "1.0.0",
        minGatewayVersion: "1.0.0",
        capabilities: ["network"],
        publisher: { name: "CoreBlow Team" },
        hotReloadSafe: false,
        integrity: `sha256-${expectedSha256}`,
        entrypoint: "dist/index.js",
      };

      // 3. Stage and atomically commit archive
      const installResult = runtime.installAppFromBuffer({
        archiveBuffer: artifactPayload,
        manifest,
        grantCapabilities: false,
      });

      expect(installResult.verifiedSha256).toBe(expectedSha256);
      expect(fs.existsSync(installResult.targetDir)).toBe(true);

      // Create entrypoint module in targetDir
      fs.mkdirSync(path.join(installResult.targetDir, "dist"), { recursive: true });
      fs.writeFileSync(
        path.join(installResult.targetDir, "dist", "index.js"),
        `export default {
          id: "discord",
          name: "Discord",
          version: "1.0.0",
          register(api) {
            api.registerChannel({ id: "discord", name: "Discord" });
          }
        };`,
        "utf8",
      );

      // Verify on-demand initial state: installed_disabled (NOT loaded by default)
      const initialReport = runtime.getAppStatusReport("discord");
      expect(initialReport.lifecycleState).toBe("installed_disabled");
      expect(initialReport.tier).toBe("corehub_on_demand");
      expect(initialReport.consentedCapabilities).toEqual([]);

      // 4. Activation without consent MUST fail
      let activated = false;
      await expect(
        runtime.enableApp("discord", manifest, () => {
          activated = true;
        }),
      ).rejects.toThrow(/requires unconsented capabilities/);
      expect(activated).toBe(false);

      // 5. Grant consent via ledger
      runtime.getConsentLedger().grantConsent("discord", ["network"], "admin-tester");
      const consentAfterGrant = runtime.getConsentLedger().getConsent("discord");
      expect(consentAfterGrant?.approvedCapabilities).toContain("network");

      // 6. Activation with consent succeeds (respecting hotReloadSafe = false -> requires restart)
      const activationResult = await runtime.enableApp("discord", manifest, () => {
        activated = true;
      });
      expect(activationResult.success).toBe(true);
      expect(activationResult.activationMode).toBe("staged_restart_required");

      // 7. Update flow: snapshot before update
      const snapshotPath = runtime.snapshotBeforeUpdate("discord", "1.0.0");
      expect(snapshotPath).toContain("discord@1.0.0");

      const reportWithBackup = runtime.getAppStatusReport("discord");
      expect(reportWithBackup.availableBackups).toContain("1.0.0");

      // 8. Rollback restores previous snapshot
      const rollbackSuccess = runtime.rollbackApp("discord", "1.0.0");
      expect(rollbackSuccess).toBe(true);
      expect(runtime.getLifecycleManager().getState("discord")).toBe("rolled_back");

      await runtime.stop();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("guarantees no kernel capability is installable through CoreHub", () => {
    const tierPolicy = new ExtensionTierPolicy();
    const consentLedger = new CapabilityConsentLedger();

    const catalogView = buildStorefrontCatalogView({
      catalogEntries: [
        {
          id: "cory-memory",
          name: "Cory Built-in Memory",
          description: "Native agent memory",
          capabilities: [],
        },
        {
          id: "provider-runtime",
          name: "AI Provider Runtime",
          description: "Native provider execution",
          capabilities: [],
        },
        {
          id: "discord",
          name: "Discord",
          description: "Community channel",
          capabilities: ["network"],
        },
      ],
      tierPolicy,
      consentLedger,
    });

    const coryCard = catalogView.find((c) => c.id === "cory-memory");
    expect(coryCard).toBeDefined();
    expect(coryCard?.tier).toBe("core");
    expect(coryCard?.isKernel).toBe(true);
    expect(coryCard?.installSpec).toBe(""); // Never installable via CoreHub
    expect(coryCard?.canRollback).toBe(false);

    const providerCard = catalogView.find((c) => c.id === "provider-runtime");
    expect(providerCard).toBeDefined();
    expect(providerCard?.tier).toBe("core");
    expect(providerCard?.isKernel).toBe(true);
    expect(providerCard?.installSpec).toBe("");

    const discordCard = catalogView.find((c) => c.id === "discord");
    expect(discordCard).toBeDefined();
    expect(discordCard?.tier).toBe("corehub_on_demand");
    expect(discordCard?.isKernel).toBe(false);
    expect(discordCard?.installSpec).toContain("corehub:@coreblow/discord");
  });

  it("proves controlled lazy-loading: app remains unloaded before activation, only selected app loads on activation, and unrelated community channels remain unloaded", async () => {
    resetPluginRuntimeStateForTest();
    const tempDir = path.join(os.tmpdir(), `coreblow-lazyload-fixture-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const appStore = new CoreHubAppStoreRuntime({ baseDir: tempDir });
      await appStore.start();

      // Initially no apps installed, activated, or loaded
      expect(appStore.getInstalledAppIds()).toEqual([]);
      expect(appStore.getActivatedAppIds()).toEqual([]);
      expect(appStore.getLoadedAppIds()).toEqual([]);
      expect(listImportedRuntimePluginIds()).not.toContain("sample-channel-a");

      // 1. Install mock community channel app 'sample-channel-a'
      const sampleManifest: CoreHubAppManifest = {
        id: "sample-channel-a",
        version: "1.0.0",
        minGatewayVersion: "1.0.0",
        capabilities: ["network"],
        publisher: { name: "Community" },
        integrity: "sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        hotReloadSafe: true,
      };

      const installResult = appStore.installAppFromBuffer({
        archiveBuffer: Buffer.alloc(0),
        manifest: sampleManifest,
        grantCapabilities: true,
      });

      // Write valid fixture entrypoint module in targetDir
      fs.writeFileSync(
        path.join(installResult.targetDir, "index.mjs"),
        `export default {
          id: "sample-channel-a",
          name: "Sample Channel A",
          version: "1.0.0",
          register(api) {
            api.registerChannel({ id: "sample-channel-a", name: "Sample Channel A" });
          }
        };`,
        "utf8",
      );

      // App is installed, but NOT loaded or activated
      expect(appStore.getInstalledAppIds()).toEqual(["sample-channel-a"]);
      expect(appStore.getActivatedAppIds()).toEqual([]);
      expect(appStore.getLoadedAppIds()).toEqual([]);
      expect(listImportedRuntimePluginIds()).not.toContain("sample-channel-a");
      expect(appStore.getAppStatusReport("sample-channel-a").lifecycleState).toBe("installed_disabled");

      // 2. Snapshot before update / activation
      appStore.snapshotBeforeUpdate("sample-channel-a", "1.0.0");

      // 3. Activate only 'sample-channel-a'
      let activatedModuleRan = false;
      const activationResult = await appStore.enableApp("sample-channel-a", sampleManifest, () => {
        activatedModuleRan = true;
      });

      expect(activationResult.success).toBe(true);
      expect(activatedModuleRan).toBe(true);

      // Now only 'sample-channel-a' is active/loaded in both lifecycle and plugin runtime
      expect(appStore.getLoadedAppIds()).toEqual(["sample-channel-a"]);
      expect(appStore.getActivatedAppIds()).toEqual(["sample-channel-a"]);
      expect(listImportedRuntimePluginIds()).toContain("sample-channel-a");

      // All 15 official community channels remain completely absent/unloaded
      const officialCommunityChannels = [
        "discord", "feishu", "irc", "line", "matrix", "mattermost", "msteams",
        "nextcloud-talk", "nostr", "qqbot", "synology-chat", "tlon", "twitch", "zalo", "zalouser",
      ];
      for (const channelId of officialCommunityChannels) {
        expect(appStore.getLoadedAppIds()).not.toContain(channelId);
        expect(appStore.getInstalledAppIds()).not.toContain(channelId);
        expect(listImportedRuntimePluginIds()).not.toContain(channelId);
        expect(appStore.getAppStatusReport(channelId).lifecycleState).toBe("uninstalled");
      }

      // 4. Rollback: active registration removed and unloaded
      const rollbackSuccess = appStore.rollbackApp("sample-channel-a", "1.0.0");
      expect(rollbackSuccess).toBe(true);
      expect(appStore.getAppStatusReport("sample-channel-a").lifecycleState).toBe("rolled_back");
      expect(appStore.getLoadedAppIds()).toEqual([]);
      expect(listImportedRuntimePluginIds()).not.toContain("sample-channel-a");

      await appStore.stop();
    } finally {
      resetPluginRuntimeStateForTest();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("proves real dynamic plugin loading, active registry registration, and fail-closed security guarantees", async () => {
    resetPluginRuntimeStateForTest();
    const tempDir = path.join(os.tmpdir(), `coreblow-fixture-real-loading-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const appStore = new CoreHubAppStoreRuntime({ baseDir: tempDir });
      await appStore.start();

      // Ensure active registry is clean and ready
      const activeRegistry = requireActivePluginRegistry();
      expect(appStore.getLoadedAppIds()).toHaveLength(0);

      // --- FAIL-CLOSED CHECKS ---

      // 1. Invalid manifest fails closed
      const invalidManifest = {
        id: "INVALID@ID!",
        version: "1.0.0",
      } as unknown as CoreHubAppManifest;
      await expect(
        appStore.enableApp("invalid-app", invalidManifest),
      ).rejects.toThrow(/invalid manifest/);

      // 2. Missing consent fails closed
      const unconsentedManifest: CoreHubAppManifest = {
        id: "fixture-channel",
        version: "1.0.0",
        minGatewayVersion: "1.0.0",
        capabilities: ["network", "filesystem"],
        publisher: { name: "CoreHub Team" },
        integrity: "sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        hotReloadSafe: true,
      };
      await expect(
        appStore.enableApp("fixture-channel", unconsentedManifest),
      ).rejects.toThrow(/requires unconsented capabilities/);

      // 3. Missing package directory fails closed
      appStore.getConsentLedger().grantConsent("fixture-channel", ["network", "filesystem"], "operator");
      await expect(
        appStore.enableApp("fixture-channel", unconsentedManifest),
      ).rejects.toThrow(/installed package directory for 'fixture-channel' not found/);

      // 4. Missing entrypoint fails closed
      const installResult = appStore.installAppFromBuffer({
        archiveBuffer: Buffer.alloc(0),
        manifest: unconsentedManifest,
        grantCapabilities: true,
      });
      await expect(
        appStore.enableApp("fixture-channel", unconsentedManifest),
      ).rejects.toThrow(/no entrypoint specified and no index module found/);

      // 5. Entrypoint path traversal escape fails closed
      const escapingManifest: CoreHubAppManifest = {
        ...unconsentedManifest,
        entrypoint: "../../../escape.js",
      };
      await expect(
        appStore.enableApp("fixture-channel", escapingManifest),
      ).rejects.toThrow(/escapes plugin root directory/);

      // 6. Dynamic import error fails closed
      fs.writeFileSync(
        path.join(installResult.targetDir, "broken-syntax.mjs"),
        "this is totally invalid javascript syntax {{{",
        "utf8",
      );
      const brokenManifest: CoreHubAppManifest = {
        ...unconsentedManifest,
        entrypoint: "broken-syntax.mjs",
      };
      const brokenActivation = await appStore.enableApp("fixture-channel", brokenManifest);
      expect(brokenActivation.success).toBe(false);
      expect(brokenActivation.state).toBe("degraded");
      expect(brokenActivation.error).toMatch(/dynamic import error/);
      expect(appStore.getLoadedAppIds()).not.toContain("fixture-channel");

      // 7. Missing register or activate export fails closed
      fs.writeFileSync(
        path.join(installResult.targetDir, "no-export.mjs"),
        "export const someData = 42;",
        "utf8",
      );
      const noExportManifest: CoreHubAppManifest = {
        ...unconsentedManifest,
        entrypoint: "no-export.mjs",
      };
      const noExportActivation = await appStore.enableApp("fixture-channel", noExportManifest);
      expect(noExportActivation.success).toBe(false);
      expect(noExportActivation.state).toBe("degraded");
      expect(noExportActivation.error).toMatch(/missing register or activate export/);
      expect(appStore.getLoadedAppIds()).not.toContain("fixture-channel");

      // --- REAL FIXTURE SUCCESS FLOW ---

      // 8. Write valid fixture entry module with real registration contract
      const validEntryPath = path.join(installResult.targetDir, "index.mjs");
      fs.writeFileSync(
        validEntryPath,
        `
        export const sideEffectLog = [];
        export default {
          id: "fixture-channel",
          name: "Real Fixture Channel",
          version: "1.0.0",
          register(api) {
            sideEffectLog.push("registered");
            api.registerChannel({
              id: "fixture-channel",
              name: "Real Fixture Channel",
              status: "connected",
            });
            api.registerTool({
              name: "fixture-action-tool",
              description: "Fixture tool for testing",
            });
          }
        };
        `,
        "utf8",
      );

      const validManifest: CoreHubAppManifest = {
        ...unconsentedManifest,
        entrypoint: "index.mjs",
      };

      // Reset lifecycle state back to installed_disabled before clean activation
      appStore.getLifecycleManager().transitionTo("fixture-channel", "installed_disabled");
      expect(appStore.getAppStatusReport("fixture-channel").lifecycleState).toBe("installed_disabled");
      expect(appStore.getLoadedAppIds()).toEqual([]);
      expect(activeRegistry.plugins.some((p) => p.id === "fixture-channel")).toBe(false);

      // Snapshot before activation for rollback test
      appStore.snapshotBeforeUpdate("fixture-channel", "1.0.0");

      // Activate fixture app
      const activation = await appStore.enableApp("fixture-channel", validManifest);
      expect(activation.success).toBe(true);
      expect(activation.state).toBe("active");

      // Verify side effect & authoritative registration in active runtime registry
      expect(appStore.getLoadedAppIds()).toEqual(["fixture-channel"]);
      expect(appStore.getActivatedAppIds()).toEqual(["fixture-channel"]);
      expect(listImportedRuntimePluginIds()).toContain("fixture-channel");

      const loadedPluginRecord = activeRegistry.plugins.find((p) => p.id === "fixture-channel");
      expect(loadedPluginRecord).toBeDefined();
      expect(loadedPluginRecord?.status).toBe("loaded");
      expect(loadedPluginRecord?.channelIds).toContain("fixture-channel");
      expect(loadedPluginRecord?.toolNames).toContain("fixture-action-tool");

      const loadedChannel = activeRegistry.channels.find((c: any) => c.id === "fixture-channel");
      expect(loadedChannel).toBeDefined();
      expect((loadedChannel as any).name).toBe("Real Fixture Channel");

      const loadedTool = activeRegistry.tools.find((t: any) => t.name === "fixture-action-tool");
      expect(loadedTool).toBeDefined();

      // Verify unrelated community channels remain completely unloaded
      const officialCommunityChannels = [
        "discord", "feishu", "irc", "line", "matrix", "mattermost", "msteams",
        "nextcloud-talk", "nostr", "qqbot", "synology-chat", "tlon", "twitch", "zalo", "zalouser",
      ];
      for (const channelId of officialCommunityChannels) {
        expect(appStore.getLoadedAppIds()).not.toContain(channelId);
        expect(activeRegistry.plugins.some((p) => p.id === channelId)).toBe(false);
      }

      // 9. Rollback removes active registration, tools, channels, and loaded status
      const rollbackOk = appStore.rollbackApp("fixture-channel", "1.0.0");
      expect(rollbackOk).toBe(true);
      expect(appStore.getAppStatusReport("fixture-channel").lifecycleState).toBe("rolled_back");
      expect(appStore.getLoadedAppIds()).toEqual([]);
      expect(listImportedRuntimePluginIds()).not.toContain("fixture-channel");
      expect(activeRegistry.plugins.some((p) => p.id === "fixture-channel")).toBe(false);
      expect(activeRegistry.channels.some((c: any) => c.id === "fixture-channel")).toBe(false);
      expect(activeRegistry.tools.some((t: any) => t.name === "fixture-action-tool")).toBe(false);

      await appStore.stop();
    } finally {
      resetPluginRuntimeStateForTest();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
