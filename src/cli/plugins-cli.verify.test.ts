import { beforeEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  buildPluginInspectReport,
  buildPluginStatusReport,
  loadConfig,
  parseCoreHubPluginSpec,
  resetPluginsCliTestState,
  runPluginsCommand,
  runtimeErrors,
  runtimeLogs,
} from "./plugins-cli-test-helpers.js";

function createCoreHubConfig(): CoreBlowConfig {
  return {
    plugins: {
      installs: {
        "plugin-lab": {
          source: "corehub",
          spec: "corehub:plugin-lab@0.1.0",
          installPath: "/tmp/coreblow/extensions/plugin-lab",
          version: "0.1.0",
          integrity: "sha256-archive",
          resolvedAt: "2026-05-20T14:10:13.467Z",
          corehubUrl: "https://coreblow.com/corehub",
          corehubPackage: "plugin-lab",
          corehubFamily: "code-plugin",
          corehubChannel: "official",
          artifactSha256: "artifact-sha256",
          artifactSize: 736,
          artifactManifestVerified: true,
          artifactManifestSha256: "manifest-sha256",
          artifactStorageKey: "artifacts/plugin-lab-0.1.0.coreblow-plugin.tgz",
          publisherHandle: "coreblow",
          verifiedAt: "2026-05-20T14:10:13.467Z",
        },
      },
    },
  } as CoreBlowConfig;
}

function createInspectReport() {
  return {
    workspaceDir: "/tmp/workspace",
    plugin: {
      id: "plugin-lab",
      name: "Plugin Lab",
      description: "Compatibility lab",
      source: "/tmp/coreblow/extensions/plugin-lab/index.js",
      origin: "global",
      status: "loaded",
      format: "coreblow",
      version: "0.1.0",
    },
    shape: "plain-capability",
    capabilityMode: "plain",
    capabilityCount: 1,
    capabilities: [],
    typedHooks: [],
    customHooks: [],
    tools: [],
    commands: [],
    cliCommands: [],
    services: [],
    gatewayMethods: [],
    mcpServers: [],
    lspServers: [],
    httpRouteCount: 0,
    bundleCapabilities: [],
    diagnostics: [],
    policy: {
      allowedModels: [],
      hasAllowedModelsConfig: false,
    },
    usesLegacyBeforeAgentStart: false,
    compatibility: [],
  };
}

describe("plugins cli verify", () => {
  beforeEach(() => {
    resetPluginsCliTestState();
    loadConfig.mockReturnValue(createCoreHubConfig());
    buildPluginStatusReport.mockReturnValue({
      plugins: [
        {
          id: "plugin-lab",
          name: "Plugin Lab",
        },
      ],
      diagnostics: [],
    });
  });

  it("prints recorded CoreHub trust proof for an installed plugin", async () => {
    await runPluginsCommand(["plugins", "verify", "plugin-lab"]);

    expect(runtimeLogs.join("\n")).toContain("Trust proof: plugin-lab");
    expect(runtimeLogs.join("\n")).toContain("Publisher: coreblow");
    expect(runtimeLogs.join("\n")).toContain("Artifact SHA-256: artifact-sha256");
    expect(runtimeLogs.join("\n")).toContain("Artifact manifest verified: yes");
    expect(runtimeLogs.join("\n")).toContain(
      "Storage locator: artifacts/plugin-lab-0.1.0.coreblow-plugin.tgz",
    );
  });

  it("resolves CoreHub package specifiers before showing trust proof", async () => {
    parseCoreHubPluginSpec.mockReturnValue({ name: "plugin-lab" });

    await runPluginsCommand(["plugins", "verify", "corehub:plugin-lab"]);

    expect(runtimeLogs.join("\n")).toContain("Artifact manifest SHA-256: manifest-sha256");
  });

  it("prints trust proof as JSON for automation", async () => {
    await runPluginsCommand(["plugins", "verify", "plugin-lab", "--json"]);

    const payload = JSON.parse(runtimeLogs.at(-1) ?? "{}") as {
      pluginId?: string;
      ok?: boolean;
      proof?: { artifactSha256?: string; publisherHandle?: string };
    };
    expect(payload).toMatchObject({
      pluginId: "plugin-lab",
      ok: true,
      proof: {
        artifactSha256: "artifact-sha256",
        publisherHandle: "coreblow",
      },
    });
  });

  it("fails when no CoreHub trust proof is recorded", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        installs: {
          alpha: {
            source: "npm",
            spec: "alpha",
          },
        },
      },
    } as CoreBlowConfig);

    await expect(runPluginsCommand(["plugins", "verify", "alpha"])).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain("No CoreHub trust proof recorded for plugin: alpha");
  });

  it("includes trust proof in plugin info output", async () => {
    buildPluginInspectReport.mockReturnValue(createInspectReport());

    await runPluginsCommand(["plugins", "info", "plugin-lab"]);

    expect(runtimeLogs.join("\n")).toContain("Trust proof:");
    expect(runtimeLogs.join("\n")).toContain("Artifact manifest verified: yes");
    expect(buildPluginInspectReport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "plugin-lab",
      }),
    );
  });
});
