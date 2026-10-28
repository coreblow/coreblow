import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PluginCapabilitySandbox,
  PluginCapabilityViolationError,
} from "./capability-sandbox.js";

describe("PluginCapabilitySandbox", () => {
  let sandbox: PluginCapabilitySandbox;
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-plugin-sandbox-test-"));
    sandbox = new PluginCapabilitySandbox();
    await sandbox.start();
  });

  afterEach(async () => {
    await sandbox.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(sandbox.health().status).toBe("healthy");
    await sandbox.stop();
    expect(sandbox.health().status).toBe("down");
  });

  it("allows filesystem access within designated roots and blocks path traversal escapes", () => {
    const pluginWorkspace = path.join(tempRoot, "plugin-data");
    sandbox.registerPlugin({
      pluginId: "data-analyzer-plugin",
      capabilities: ["filesystem:read", "filesystem:write"],
      allowedRoots: [pluginWorkspace],
    });

    const validFile = path.join(pluginWorkspace, "output.json");
    expect(() =>
      sandbox.validateFilesystemAccess("data-analyzer-plugin", validFile, "write"),
    ).not.toThrow();

    // Traversal attack attempting to escape sandbox
    const escapeFile = path.join(pluginWorkspace, "../../../etc/passwd");
    expect(() =>
      sandbox.validateFilesystemAccess("data-analyzer-plugin", escapeFile, "read"),
    ).toThrow(PluginCapabilityViolationError);

    // Read-only plugin attempting write
    sandbox.registerPlugin({
      pluginId: "readonly-viewer",
      capabilities: ["filesystem:read"],
      allowedRoots: [pluginWorkspace],
    });

    expect(() =>
      sandbox.validateFilesystemAccess("readonly-viewer", validFile, "write"),
    ).toThrow(PluginCapabilityViolationError);
  });

  it("enforces outbound network egress allowlist rules (OWASP ASI04)", () => {
    sandbox.registerPlugin({
      pluginId: "weather-service-plugin",
      capabilities: ["network:egress"],
      allowedDomains: ["api.weather.com", "*.trusted-services.org"],
    });

    // Allowed exact match
    expect(() =>
      sandbox.validateNetworkEgress(
        "weather-service-plugin",
        "https://api.weather.com/v1/forecast?city=Boston",
      ),
    ).not.toThrow();

    // Allowed wildcard subdomain match
    expect(() =>
      sandbox.validateNetworkEgress(
        "weather-service-plugin",
        "https://sub.trusted-services.org/data",
      ),
    ).not.toThrow();

    // Denied untrusted destination (exfiltration attempt)
    expect(() =>
      sandbox.validateNetworkEgress(
        "weather-service-plugin",
        "https://malicious-exfil-server.com/sink",
      ),
    ).toThrow(PluginCapabilityViolationError);

    // Plugin with no network capability attempting egress
    sandbox.registerPlugin({
      pluginId: "offline-calc-plugin",
      capabilities: ["filesystem:read"],
    });

    expect(() =>
      sandbox.validateNetworkEgress(
        "offline-calc-plugin",
        "https://api.weather.com/v1/forecast",
      ),
    ).toThrow(PluginCapabilityViolationError);
  });

  it("enforces environment variable scoping and blocks sensitive credentials", () => {
    sandbox.registerPlugin({
      pluginId: "crm-sync-plugin",
      capabilities: ["env:read"],
      allowedEnvVars: ["CRM_API_ENDPOINT", "CRM_ACCOUNT_ID"],
    });

    // Allowed declared env var
    expect(() =>
      sandbox.validateEnvAccess("crm-sync-plugin", "CRM_API_ENDPOINT"),
    ).not.toThrow();

    // Denied undeclared env var
    expect(() =>
      sandbox.validateEnvAccess("crm-sync-plugin", "DATABASE_URL"),
    ).toThrow(PluginCapabilityViolationError);

    // Denied sensitive gateway tokens and core system secrets
    expect(() =>
      sandbox.validateEnvAccess("crm-sync-plugin", "COREBLOW_GATEWAY_TOKEN"),
    ).toThrow(PluginCapabilityViolationError);

    expect(() =>
      sandbox.validateEnvAccess("crm-sync-plugin", "OPENAI_API_KEY"),
    ).toThrow(PluginCapabilityViolationError);
  });

  it("validates process execution capability", () => {
    sandbox.registerPlugin({
      pluginId: "linter-plugin",
      capabilities: ["process:exec"],
    });

    expect(() =>
      sandbox.validateProcessExec("linter-plugin", "eslint src/"),
    ).not.toThrow();

    sandbox.registerPlugin({
      pluginId: "unprivileged-plugin",
      capabilities: ["filesystem:read"],
    });

    expect(() =>
      sandbox.validateProcessExec("unprivileged-plugin", "sh -c rm -rf /"),
    ).toThrow(PluginCapabilityViolationError);
  });
});
