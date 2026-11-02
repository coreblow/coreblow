import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CoreHubAppManifest } from "./app-store-contract.js";
import { CoreHubAppStoreRuntime } from "./app-store-runtime.js";

describe("CoreHubAppStoreRuntime", () => {
  let testDir: string;
  let runtime: CoreHubAppStoreRuntime;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `coreblow-runtime-test-${crypto.randomUUID()}`);
    fs.mkdirSync(testDir, { recursive: true });
    runtime = new CoreHubAppStoreRuntime({ baseDir: testDir });
    await runtime.start();
  });

  afterEach(async () => {
    await runtime.stop();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("satisfies GatewayService lifecycle and health monitoring", async () => {
    expect(runtime.name).toBe("corehub-app-store");
    expect(runtime.health().status).toBe("healthy");
    await runtime.stop();
    expect(runtime.health().status).toBe("down");
  });

  it("executes end-to-end flow: install -> consent gate -> enable -> update -> rollback", async () => {
    const payload = Buffer.from("console.log('v1 channel code');");
    const sha256 = crypto.createHash("sha256").update(payload).digest("hex");

    const manifestV1: CoreHubAppManifest = {
      id: "discord",
      version: "1.0.0",
      minGatewayVersion: ">=1.0.0",
      capabilities: ["network", "credentials"],
      publisher: { name: "CoreBlow", url: "https://coreblow.com/corehub" },
      hotReloadSafe: false, // stateful socket channel
      integrity: `sha256-${sha256}`,
    };

    // 1. Install app from buffer
    const installResult = runtime.installAppFromBuffer({
      archiveBuffer: payload,
      manifest: manifestV1,
      grantCapabilities: false,
    });

    expect(fs.existsSync(installResult.targetDir)).toBe(true);
    expect(runtime.getLifecycleManager().getState("discord")).toBe("installed_disabled");

    // 2. Enable app without consent -> MUST FAIL
    let activated = false;
    await expect(
      runtime.enableApp("discord", manifestV1, () => {
        activated = true;
      }),
    ).rejects.toThrow(/Activation blocked: plugin 'discord' requires unconsented capabilities/);
    expect(activated).toBe(false);

    // 3. Grant consent and enable app (hotReloadSafe: false -> staged_restart_required)
    runtime.getConsentLedger().grantConsent("discord", ["network", "credentials"], "tester");
    const enableResult = await runtime.enableApp("discord", manifestV1, () => {
      activated = true;
    });

    // Activated fn should NOT be called directly because hotReloadSafe is false
    expect(activated).toBe(false);
    expect(enableResult.activationMode).toBe("staged_restart_required");
    expect(enableResult.state).toBe("installed_disabled");

    // 4. Test hot-reload safe plugin activation
    const hotPayload = Buffer.from("console.log('webhook channel code');");
    const hotSha256 = crypto.createHash("sha256").update(hotPayload).digest("hex");
    const hotManifest: CoreHubAppManifest = {
      id: "webhook-ext",
      version: "1.0.0",
      minGatewayVersion: ">=1.0.0",
      capabilities: ["webhook"],
      publisher: { name: "CoreBlow" },
      hotReloadSafe: true,
      integrity: `sha256-${hotSha256}`,
    };

    runtime.installAppFromBuffer({
      archiveBuffer: hotPayload,
      manifest: hotManifest,
      grantCapabilities: true,
    });

    let hotActivated = false;
    const hotResult = await runtime.enableApp("webhook-ext", hotManifest, () => {
      hotActivated = true;
    });

    expect(hotActivated).toBe(true);
    expect(hotResult.activationMode).toBe("hot_reload");
    expect(hotResult.state).toBe("active");
    expect(runtime.getLifecycleManager().getState("webhook-ext")).toBe("active");

    // 5. Test fault domain isolation on boot error
    const crashingManifest: CoreHubAppManifest = {
      id: "faulty-ext",
      version: "1.0.0",
      minGatewayVersion: ">=1.0.0",
      capabilities: [],
      publisher: { name: "CoreBlow" },
      hotReloadSafe: true,
      integrity: `sha256-${hotSha256}`,
    };

    runtime.installAppFromBuffer({
      archiveBuffer: hotPayload,
      manifest: crashingManifest,
      grantCapabilities: true,
    });

    const crashResult = await runtime.enableApp("faulty-ext", crashingManifest, () => {
      throw new Error("Simulated connection timeout");
    });

    expect(crashResult.success).toBe(false);
    expect(crashResult.state).toBe("degraded");
    expect(crashResult.error).toBe("Simulated connection timeout");
    expect(runtime.getLifecycleManager().getState("faulty-ext")).toBe("degraded");

    // 6. Test snapshot and rollback
    const discordDir = path.join(testDir, "extensions", "discord");
    fs.writeFileSync(path.join(discordDir, "version.json"), JSON.stringify({ v: "1.0.0" }));

    // Snapshot before update
    const snapshotPath = runtime.snapshotBeforeUpdate("discord", "1.0.0");
    expect(fs.existsSync(snapshotPath)).toBe(true);

    // Simulate broken update
    fs.writeFileSync(path.join(discordDir, "version.json"), JSON.stringify({ v: "2.0.0-broken" }));

    // Rollback
    const rolledBack = runtime.rollbackApp("discord", "1.0.0");
    expect(rolledBack).toBe(true);
    expect(runtime.getLifecycleManager().getState("discord")).toBe("rolled_back");
    const restoredContent = JSON.parse(
      fs.readFileSync(path.join(discordDir, "version.json"), "utf8"),
    );
    expect(restoredContent.v).toBe("1.0.0");

    // 7. Verify status report
    const statusReport = runtime.getAppStatusReport("discord");
    expect(statusReport.id).toBe("discord");
    expect(statusReport.tier).toBe("corehub_on_demand");
    expect(statusReport.lifecycleState).toBe("rolled_back");
    expect(statusReport.consentedCapabilities).toEqual(["network", "credentials"]);
    expect(statusReport.availableBackups).toContain("1.0.0");
  });
});
