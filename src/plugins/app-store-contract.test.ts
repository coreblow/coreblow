import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AtomicPluginStageManager,
  CapabilityConsentLedger,
  type CoreHubAppManifest,
  PluginLifecycleManager,
  safeActivatePlugin,
  validateCoreHubAppManifest,
} from "./app-store-contract.js";

describe("CoreHub 7-Pillar App Store Contract", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `coreblow-test-contract-${crypto.randomUUID()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Pillar 1: DOP Manifest Schema & Pure Validation
  // ==========================================================================
  describe("Pillar 1: Manifest Schema & Pure Validation", () => {
    it("validates a compliant CoreHub app manifest", () => {
      const raw = {
        id: "sample-plugin",
        version: "1.2.3",
        minGatewayVersion: ">=1.0.0",
        capabilities: ["network", "credentials"],
        publisher: {
          name: "CoreBlow Team",
          url: "https://coreblow.com",
        },
        hotReloadSafe: true,
        integrity: "sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        description: "A sample test plugin",
      };

      const result = validateCoreHubAppManifest(raw);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.manifest.id).toBe("sample-plugin");
        expect(result.manifest.capabilities).toEqual(["network", "credentials"]);
        expect(result.manifest.hotReloadSafe).toBe(true);
      }
    });

    it("rejects manifests with missing or invalid fields", () => {
      const invalid = {
        id: "",
        version: "invalid-semver",
        capabilities: ["unsupported_capability"],
        publisher: {},
        hotReloadSafe: "not-a-boolean",
        integrity: "short",
      };

      const result = validateCoreHubAppManifest(invalid);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(5);
        expect(result.errors.some((err) => err.includes("id"))).toBe(true);
        expect(result.errors.some((err) => err.includes("version"))).toBe(true);
        expect(result.errors.some((err) => err.includes("capability"))).toBe(true);
        expect(result.errors.some((err) => err.includes("hotReloadSafe"))).toBe(true);
        expect(result.errors.some((err) => err.includes("integrity"))).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Pillar 2: OOP Atomic Staging Installer
  // ==========================================================================
  describe("Pillar 2: Atomic Staging Installer", () => {
    it("stages, verifies checksum, and atomically commits the plugin", () => {
      const stageManager = new AtomicPluginStageManager({ baseDir: testDir });
      const payload = Buffer.from("console.log('plugin loaded');");
      const sha256 = crypto.createHash("sha256").update(payload).digest("hex");

      const manifest: CoreHubAppManifest = {
        id: "demo-ext",
        version: "1.0.0",
        minGatewayVersion: ">=1.0.0",
        capabilities: ["network"],
        publisher: { name: "Tester" },
        hotReloadSafe: true,
        integrity: `sha256-${sha256}`,
      };

      // 1. Stage archive
      const { stageDir, verifiedSha256 } = stageManager.stageArchive("demo-ext", payload, manifest);
      expect(verifiedSha256).toBe(sha256);
      expect(fs.existsSync(stageDir)).toBe(true);

      // 2. Commit staging
      const targetDir = stageManager.commitStagedPlugin(stageDir, "demo-ext");
      expect(fs.existsSync(targetDir)).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "package.tar"))).toBe(true);
      expect(fs.existsSync(stageDir)).toBe(false);
    });

    it("rejects staging if the integrity digest does not match", () => {
      const stageManager = new AtomicPluginStageManager({ baseDir: testDir });
      const payload = Buffer.from("bad content");

      const manifest: CoreHubAppManifest = {
        id: "bad-ext",
        version: "1.0.0",
        minGatewayVersion: ">=1.0.0",
        capabilities: [],
        publisher: { name: "Tester" },
        hotReloadSafe: true,
        integrity: "sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      };

      expect(() => stageManager.stageArchive("bad-ext", payload, manifest)).toThrow(
        /Integrity check failed/,
      );
    });
  });

  // ==========================================================================
  // Pillar 3: Capability Consent Ledger
  // ==========================================================================
  describe("Pillar 3: Capability Consent Ledger", () => {
    it("records and enforces operator consent for plugin capabilities", () => {
      const ledger = new CapabilityConsentLedger({ baseDir: testDir });

      const manifest: CoreHubAppManifest = {
        id: "secure-plugin",
        version: "1.0.0",
        minGatewayVersion: ">=1.0.0",
        capabilities: ["network", "filesystem"],
        publisher: { name: "SecOps" },
        hotReloadSafe: true,
        integrity: "sha256-abcdef",
      };

      // Initially unapproved
      const initialCheck = ledger.checkConsent(manifest);
      expect(initialCheck.allowed).toBe(false);
      expect(initialCheck.missingCapabilities).toEqual(["network", "filesystem"]);

      // Operator grants consent
      ledger.grantConsent("secure-plugin", ["network", "filesystem"], "admin-user");

      const approvedCheck = ledger.checkConsent(manifest);
      expect(approvedCheck.allowed).toBe(true);
      expect(approvedCheck.missingCapabilities).toEqual([]);

      // Operator revokes consent
      ledger.revokeConsent("secure-plugin");
      expect(ledger.checkConsent(manifest).allowed).toBe(false);
    });
  });

  // ==========================================================================
  // Pillar 4: OOP 6-State Lifecycle & Rollback
  // ==========================================================================
  describe("Pillar 4: 6-State Lifecycle & Rollback", () => {
    it("tracks state transitions, snapshots prior versions, and rolls back cleanly", () => {
      const lifecycle = new PluginLifecycleManager({ baseDir: testDir });
      const pluginId = "my-plugin";

      expect(lifecycle.getState(pluginId)).toBe("uninstalled");

      // Simulate installation
      const extDir = path.join(testDir, "extensions", pluginId);
      fs.mkdirSync(extDir, { recursive: true });
      fs.writeFileSync(path.join(extDir, "version.txt"), "v1.0.0");
      lifecycle.transitionTo(pluginId, "active");
      expect(lifecycle.getState(pluginId)).toBe("active");

      // Prepare update: snapshot v1.0.0
      lifecycle.transitionTo(pluginId, "updating");
      const snapshot = lifecycle.snapshotBeforeUpdate(pluginId, "1.0.0");
      expect(fs.existsSync(snapshot)).toBe(true);

      // Simulate v2 update
      fs.writeFileSync(path.join(extDir, "version.txt"), "v2.0.0-broken");
      lifecycle.transitionTo(pluginId, "degraded");

      // Rollback to v1.0.0
      const restored = lifecycle.rollbackPlugin(pluginId, "1.0.0");
      expect(restored).toBe(true);
      expect(lifecycle.getState(pluginId)).toBe("rolled_back");
      expect(fs.readFileSync(path.join(extDir, "version.txt"), "utf8")).toBe("v1.0.0");
    });
  });

  // ==========================================================================
  // Pillar 5 & 6: Fault Domain Isolation & Pragmatic Activation Gate
  // ==========================================================================
  describe("Pillar 5 & 6: Fault Isolation & Pragmatic Activation Gate", () => {
    it("gates dynamic hot-reload when hotReloadSafe is false", async () => {
      const lifecycle = new PluginLifecycleManager({ baseDir: testDir });
      let activated = false;

      const manifest: CoreHubAppManifest = {
        id: "cold-plugin",
        version: "1.0.0",
        minGatewayVersion: ">=1.0.0",
        capabilities: [],
        publisher: { name: "Ops" },
        hotReloadSafe: false, // requires staged restart
        integrity: "sha256-abcdef",
      };

      const result = await safeActivatePlugin({
        manifest,
        activateFn: () => {
          activated = true;
        },
        lifecycle,
      });

      expect(activated).toBe(false);
      expect(result.activationMode).toBe("staged_restart_required");
      expect(result.state).toBe("installed_disabled");
      expect(lifecycle.getState("cold-plugin")).toBe("installed_disabled");
    });

    it("activates successfully when hotReloadSafe is true", async () => {
      const lifecycle = new PluginLifecycleManager({ baseDir: testDir });
      let activated = false;

      const manifest: CoreHubAppManifest = {
        id: "hot-plugin",
        version: "1.0.0",
        minGatewayVersion: ">=1.0.0",
        capabilities: [],
        publisher: { name: "Ops" },
        hotReloadSafe: true,
        integrity: "sha256-abcdef",
      };

      const result = await safeActivatePlugin({
        manifest,
        activateFn: () => {
          activated = true;
        },
        lifecycle,
      });

      expect(activated).toBe(true);
      expect(result.activationMode).toBe("hot_reload");
      expect(result.state).toBe("active");
      expect(lifecycle.getState("hot-plugin")).toBe("active");
    });

    it("isolates fault domain on boot crash and transitions to degraded without throwing", async () => {
      const lifecycle = new PluginLifecycleManager({ baseDir: testDir });
      let degradedError: Error | undefined;

      const manifest: CoreHubAppManifest = {
        id: "crashing-plugin",
        version: "1.0.0",
        minGatewayVersion: ">=1.0.0",
        capabilities: [],
        publisher: { name: "Ops" },
        hotReloadSafe: true,
        integrity: "sha256-abcdef",
      };

      const result = await safeActivatePlugin({
        manifest,
        activateFn: () => {
          throw new Error("Failed to connect to backend cluster");
        },
        lifecycle,
        onDegraded: (err) => {
          degradedError = err;
        },
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe("degraded");
      expect(result.error).toBe("Failed to connect to backend cluster");
      expect(degradedError?.message).toBe("Failed to connect to backend cluster");
      expect(lifecycle.getState("crashing-plugin")).toBe("degraded");
    });

    it("recovers from incomplete staging state by discarding and cleaning orphaned tmp stages", () => {
      const stageManager = new AtomicPluginStageManager({ baseDir: testDir });
      const tmpDir = path.join(testDir, "tmp");
      const orphanDir1 = path.join(tmpDir, "orphan-uuid-1");
      const orphanDir2 = path.join(tmpDir, "orphan-uuid-2");
      fs.mkdirSync(orphanDir1, { recursive: true });
      fs.mkdirSync(orphanDir2, { recursive: true });
      fs.writeFileSync(path.join(orphanDir1, "leftover.tar"), "corrupt");

      const cleaned = stageManager.cleanupOrphanedStages();
      expect(cleaned).toBe(2);
      expect(fs.existsSync(orphanDir1)).toBe(false);
      expect(fs.existsSync(orphanDir2)).toBe(false);
    });
  });
});
