import { beforeEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  buildPluginInspectReport,
  buildPluginStatusReport,
  fetchCoreHubPackageDetail,
  fetchCoreHubPackageVersion,
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
      corehub: {
        allowCommunity: false,
        allowDeprecated: false,
        allowedPublishers: ["coreblow"],
        requiredVerificationTiers: ["source-linked"],
      },
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
          corehubVerificationTier: "source-linked",
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

  it("refreshes recorded trust proof against CoreHub Registry metadata", async () => {
    fetchCoreHubPackageDetail.mockResolvedValue({
      package: {
        name: "plugin-lab",
        ownerHandle: "coreblow",
        verification: {
          tier: "source-linked",
        },
      },
      owner: {
        handle: "coreblow",
      },
    });
    fetchCoreHubPackageVersion.mockResolvedValue({
      version: {
        version: "0.1.0",
        status: "verified",
        publisher: {
          handle: "coreblow",
        },
        artifact: {
          size: 736,
          sha256: "artifact-sha256",
          storage: {
            key: "artifacts/plugin-lab-0.1.0.coreblow-plugin.tgz",
          },
          files: [
            {
              path: "corehub.artifact.json",
              sha256: "manifest-sha256",
            },
          ],
        },
      },
    });

    await runPluginsCommand(["plugins", "verify", "plugin-lab", "--refresh"]);

    expect(fetchCoreHubPackageVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "plugin-lab",
        version: "0.1.0",
        baseUrl: "https://coreblow.com/corehub",
      }),
    );
    expect(runtimeLogs.join("\n")).toContain("Refresh: verified");
    expect(runtimeLogs.join("\n")).toContain("artifactSha256: verified");
    expect(runtimeLogs.join("\n")).toContain("artifactManifestDeclared: verified");
  });

  it("fails refresh when registry metadata no longer matches the installed proof", async () => {
    fetchCoreHubPackageDetail.mockResolvedValue({
      package: {
        name: "plugin-lab",
        ownerHandle: "coreblow",
        verification: {
          tier: "source-linked",
        },
      },
      owner: {
        handle: "coreblow",
      },
    });
    fetchCoreHubPackageVersion.mockResolvedValue({
      version: {
        version: "0.1.0",
        status: "blocked",
        artifact: {
          size: 736,
          sha256: "changed-sha256",
          storage: {
            key: "artifacts/plugin-lab-0.1.0.coreblow-plugin.tgz",
          },
          files: [
            {
              path: "corehub.artifact.json",
              sha256: "manifest-sha256",
            },
          ],
        },
      },
    });

    await expect(runPluginsCommand(["plugins", "verify", "plugin-lab", "--refresh"])).rejects.toThrow(
      "__exit__:1",
    );

    expect(runtimeLogs.join("\n")).toContain("Refresh: failed");
    expect(runtimeLogs.join("\n")).toContain("artifactSha256: changed");
    expect(runtimeLogs.join("\n")).toContain("Registry marks this version as blocked.");
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
    expect(runtimeLogs.join("\n")).toContain("Verification tier: source-linked");
    expect(buildPluginInspectReport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "plugin-lab",
      }),
    );
  });

  it("prints active CoreHub install policy and installed package status", async () => {
    await runPluginsCommand(["plugins", "policy"]);

    const output = runtimeLogs.join("\n");
    expect(output).toContain("CoreHub plugin policy");
    expect(output).toContain("Allow community packages:");
    expect(output).toContain("Allowed publishers:");
    expect(output).toContain("coreblow");
    expect(output).toContain("source-linked");
    expect(output).toContain("plugin-lab");
    expect(output).toContain("allowed");
  });

  it("prints active CoreHub install policy as JSON", async () => {
    await runPluginsCommand(["plugins", "policy", "--json"]);

    const payload = JSON.parse(runtimeLogs.at(-1) ?? "{}") as {
      policy?: { allowCommunity?: boolean; requiredVerificationTiers?: string[] };
      installed?: Array<{ pluginId?: string; status?: string; verificationTier?: string }>;
    };
    expect(payload).toMatchObject({
      policy: {
        allowCommunity: false,
        requiredVerificationTiers: ["source-linked"],
      },
      installed: [
        {
          pluginId: "plugin-lab",
          status: "allowed",
          verificationTier: "source-linked",
        },
      ],
    });
  });

  it("passes installed CoreHub policy audit when records satisfy policy", async () => {
    await runPluginsCommand(["plugins", "policy", "audit", "--json"]);

    const payload = JSON.parse(runtimeLogs.at(-1) ?? "{}") as {
      ok?: boolean;
      total?: number;
      allowed?: number;
      blocked?: number;
    };
    expect(payload).toMatchObject({
      ok: true,
      total: 1,
      allowed: 1,
      blocked: 0,
    });
  });

  it("refreshes installed CoreHub policy audit against Registry metadata", async () => {
    fetchCoreHubPackageDetail.mockResolvedValue({
      package: {
        name: "plugin-lab",
        ownerHandle: "coreblow",
        verification: {
          tier: "source-linked",
        },
      },
      owner: {
        handle: "coreblow",
      },
    });
    fetchCoreHubPackageVersion.mockResolvedValue({
      version: {
        version: "0.1.0",
        status: "available",
        publisher: {
          handle: "coreblow",
        },
        artifact: {
          size: 736,
          sha256: "artifact-sha256",
          storage: {
            key: "artifacts/plugin-lab-0.1.0.coreblow-plugin.tgz",
          },
          files: [
            {
              path: "corehub.artifact.json",
              sha256: "manifest-sha256",
            },
          ],
        },
      },
    });

    await runPluginsCommand(["plugins", "policy", "audit", "--refresh", "--json"]);

    const payload = JSON.parse(runtimeLogs.at(-1) ?? "{}") as {
      ok?: boolean;
      refresh?: { ok?: boolean; refreshed?: Array<{ pluginId?: string; ok?: boolean }> };
    };
    expect(payload.ok).toBe(true);
    expect(payload.refresh).toMatchObject({
      ok: true,
      refreshed: [
        {
          pluginId: "plugin-lab",
          ok: true,
        },
      ],
    });
    expect(fetchCoreHubPackageVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "plugin-lab",
        version: "0.1.0",
        baseUrl: "https://coreblow.com/corehub",
      }),
    );
  });

  it("fails installed CoreHub policy audit refresh when Registry trust changes", async () => {
    fetchCoreHubPackageDetail.mockResolvedValue({
      package: {
        name: "plugin-lab",
        ownerHandle: "coreblow",
        verification: {
          tier: "source-linked",
        },
      },
      owner: {
        handle: "coreblow",
      },
    });
    fetchCoreHubPackageVersion.mockResolvedValue({
      version: {
        version: "0.1.0",
        status: "blocked",
        publisher: {
          handle: "coreblow",
        },
        artifact: {
          size: 736,
          sha256: "changed-sha256",
          storage: {
            key: "artifacts/plugin-lab-0.1.0.coreblow-plugin.tgz",
          },
          files: [
            {
              path: "corehub.artifact.json",
              sha256: "manifest-sha256",
            },
          ],
        },
      },
    });

    await expect(runPluginsCommand(["plugins", "policy", "audit", "--refresh"])).rejects.toThrow(
      "__exit__:1",
    );

    const output = runtimeLogs.join("\n");
    expect(output).toContain("CoreHub policy audit");
    expect(output).toContain("Result: failed");
    expect(output).toContain("Registry refresh:");
    expect(output).toContain("plugin-lab: failed status=blocked");
    expect(output).toContain("artifactSha256: changed");
    expect(output).toContain("Registry marks this version as blocked.");
  });

  it("fails installed CoreHub policy audit when records violate policy", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        corehub: {
          allowCommunity: false,
          allowedPublishers: ["coreblow"],
          requiredVerificationTiers: ["source-linked"],
        },
        installs: {
          "plugin-lab": {
            source: "corehub",
            spec: "corehub:plugin-lab@0.1.0",
            corehubPackage: "plugin-lab",
            corehubFamily: "code-plugin",
            corehubChannel: "community",
            corehubVerificationTier: "community",
            publisherHandle: "community-dev",
            version: "0.1.0",
          },
        },
      },
    } as CoreBlowConfig);

    await expect(runPluginsCommand(["plugins", "policy", "audit"])).rejects.toThrow(
      "__exit__:1",
    );

    const output = runtimeLogs.join("\n");
    expect(output).toContain("CoreHub policy audit");
    expect(output).toContain("Result: failed");
    expect(output).toContain("BLOCKED: plugin-lab");
    expect(output).toContain("requires official channel; found community");
    expect(output).toContain("publisher community-dev is not allowed");
  });

  it("checks a CoreHub package against active policy before install", async () => {
    parseCoreHubPluginSpec.mockReturnValue({ name: "plugin-lab" });
    fetchCoreHubPackageDetail.mockResolvedValue({
      package: {
        name: "plugin-lab",
        displayName: "Plugin Lab",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        ownerHandle: "coreblow",
        createdAt: 0,
        updatedAt: 0,
        latestVersion: "0.1.0",
        verification: {
          tier: "source-linked",
        },
      },
      owner: {
        handle: "coreblow",
      },
    });
    fetchCoreHubPackageVersion.mockResolvedValue({
      version: {
        version: "0.1.0",
        createdAt: 0,
        changelog: "",
        status: "available",
        publisher: {
          handle: "coreblow",
        },
        verification: {
          tier: "source-linked",
        },
      },
    });

    await runPluginsCommand(["plugins", "policy", "check", "corehub:plugin-lab"]);

    const output = runtimeLogs.join("\n");
    expect(fetchCoreHubPackageDetail).toHaveBeenCalledWith({ name: "plugin-lab" });
    expect(fetchCoreHubPackageVersion).toHaveBeenCalledWith({
      name: "plugin-lab",
      version: "0.1.0",
    });
    expect(output).toContain("CoreHub policy check: plugin-lab");
    expect(output).toContain("Policy result: allowed");
  });

  it("fails policy check when a CoreHub package violates active policy", async () => {
    parseCoreHubPluginSpec.mockReturnValue({ name: "plugin-lab" });
    fetchCoreHubPackageDetail.mockResolvedValue({
      package: {
        name: "plugin-lab",
        displayName: "Plugin Lab",
        family: "code-plugin",
        channel: "community",
        isOfficial: false,
        ownerHandle: "community-dev",
        createdAt: 0,
        updatedAt: 0,
        latestVersion: "0.1.0",
        verification: {
          tier: "community",
        },
      },
      owner: {
        handle: "community-dev",
      },
    });
    fetchCoreHubPackageVersion.mockResolvedValue({
      version: {
        version: "0.1.0",
        createdAt: 0,
        changelog: "",
        status: "available",
        publisher: {
          handle: "community-dev",
        },
        verification: {
          tier: "community",
        },
      },
    });

    await expect(
      runPluginsCommand(["plugins", "policy", "check", "corehub:plugin-lab", "--json"]),
    ).rejects.toThrow("__exit__:1");

    const payload = JSON.parse(runtimeLogs.at(-1) ?? "{}") as {
      ok?: boolean;
      status?: string;
      notes?: string[];
    };
    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("blocked");
    expect(payload.notes).toContain("requires official channel; found community");
    expect(payload.notes).toContain("publisher community-dev is not allowed");
    expect(payload.notes).toContain("verification tier community is not allowed");
  });
});
