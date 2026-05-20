import { beforeEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  applyExclusiveSlotSelection,
  buildPluginStatusReport,
  clearPluginManifestRegistryCache,
  enablePluginInConfig,
  installHooksFromNpmSpec,
  installPluginFromCoreHub,
  installPluginFromMarketplace,
  installPluginFromNpmSpec,
  loadConfig,
  readConfigFileSnapshot,
  parseCoreHubPluginSpec,
  recordHookInstall,
  recordPluginInstall,
  resetPluginsCliTestState,
  runPluginsCommand,
  runtimeErrors,
  runtimeLogs,
  writeConfigFile,
} from "./plugins-cli-test-helpers.js";

function createEnabledPluginConfig(pluginId: string): CoreBlowConfig {
  return {
    plugins: {
      entries: {
        [pluginId]: {
          enabled: true,
        },
      },
    },
  } as CoreBlowConfig;
}

function createCoreHubInstalledConfig(params: {
  pluginId: string;
  install: Record<string, unknown>;
}): CoreBlowConfig {
  const enabledCfg = createEnabledPluginConfig(params.pluginId);
  return {
    ...enabledCfg,
    plugins: {
      ...enabledCfg.plugins,
      installs: {
        [params.pluginId]: params.install,
      },
    },
  } as CoreBlowConfig;
}

function createCoreHubInstallResult(params: {
  pluginId: string;
  packageName: string;
  version: string;
  channel: string;
}): Awaited<ReturnType<typeof installPluginFromCoreHub>> {
  return {
    ok: true,
    pluginId: params.pluginId,
    targetDir: `/tmp/coreblow-state/extensions/${params.pluginId}`,
    version: params.version,
    packageName: params.packageName,
    corehub: {
      source: "corehub",
      corehubUrl: "https://coreblow.com/corehub",
      corehubPackage: params.packageName,
      corehubFamily: "code-plugin",
      corehubChannel: params.channel,
      corehubVerificationTier: "source-linked",
      version: params.version,
      integrity: "sha256-abc",
      artifactSha256: "abc",
      artifactSize: 736,
      artifactManifestVerified: true,
      artifactManifestSha256: "manifest-abc",
      artifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
      publisherHandle: "coreblow",
      resolvedAt: "2026-03-22T00:00:00.000Z",
      verifiedAt: "2026-03-22T00:00:00.000Z",
    },
  };
}

describe("plugins cli install", () => {
  beforeEach(() => {
    resetPluginsCliTestState();
  });

  it("exits when --marketplace is combined with --link", async () => {
    await expect(
      runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo", "--link"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain("`--link` is not supported with `--marketplace`.");
    expect(installPluginFromMarketplace).not.toHaveBeenCalled();
  });

  it("exits when marketplace install fails", async () => {
    await expect(
      runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo"]),
    ).rejects.toThrow("__exit__:1");

    expect(installPluginFromMarketplace).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "local/repo",
        plugin: "alpha",
      }),
    );
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it("fails closed for unrelated invalid config before installer side effects", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfig.mockImplementation(() => {
      throw invalidConfigErr;
    });
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/coreblow-config.json5",
      exists: true,
      raw: '{ "models": { "default": 123 } }',
      parsed: { models: { default: 123 } },
      resolved: { models: { default: 123 } },
      valid: false,
      config: { models: { default: 123 } },
      hash: "mock",
      issues: [{ path: "models.default", message: "invalid model ref" }],
      warnings: [],
      legacyIssues: [],
    });

    await expect(runPluginsCommand(["plugins", "install", "alpha"])).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain(
      "Config invalid; run `coreblow doctor --fix` before installing plugins.",
    );
    expect(installPluginFromMarketplace).not.toHaveBeenCalled();
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it("installs marketplace plugins and persists config", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as CoreBlowConfig;
    const enabledCfg = {
      plugins: {
        entries: {
          alpha: {
            enabled: true,
          },
        },
      },
    } as CoreBlowConfig;
    const installedCfg = {
      ...enabledCfg,
      plugins: {
        ...enabledCfg.plugins,
        installs: {
          alpha: {
            source: "marketplace",
            installPath: "/tmp/coreblow-state/extensions/alpha",
          },
        },
      },
    } as CoreBlowConfig;

    loadConfig.mockReturnValue(cfg);
    installPluginFromMarketplace.mockResolvedValue({
      ok: true,
      pluginId: "alpha",
      kind: "memory",
      targetDir: "/tmp/coreblow-state/extensions/alpha",
      version: "1.2.3",
      marketplaceName: "Claude",
      marketplaceSource: "local/repo",
      marketplacePlugin: "alpha",
    });
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(installedCfg);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "alpha", kind: "memory" }],
      diagnostics: [],
    });
    applyExclusiveSlotSelection.mockReturnValue({
      config: installedCfg,
      warnings: ["slot adjusted"],
    });

    await runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo"]);

    expect(clearPluginManifestRegistryCache).toHaveBeenCalledTimes(1);
    expect(writeConfigFile).toHaveBeenCalledWith(installedCfg);
    expect(runtimeLogs.some((line) => line.includes("slot adjusted"))).toBe(true);
    expect(runtimeLogs.some((line) => line.includes("Installed plugin: alpha"))).toBe(true);
  });

  it("installs CoreHub plugins and persists source metadata", async () => {
    const policy = {
      allowCommunity: false,
      requiredVerificationTiers: ["source-linked"],
    };
    const cfg = {
      plugins: {
        entries: {},
        corehub: policy,
      },
    } as CoreBlowConfig;
    const enabledCfg = createEnabledPluginConfig("demo");
    const installedCfg = createCoreHubInstalledConfig({
      pluginId: "demo",
      install: {
        source: "corehub",
        spec: "corehub:demo@1.2.3",
        installPath: "/tmp/coreblow-state/extensions/demo",
        corehubPackage: "demo",
        corehubFamily: "code-plugin",
        corehubChannel: "official",
      },
    });

    loadConfig.mockReturnValue(cfg);
    parseCoreHubPluginSpec.mockReturnValue({ name: "demo" });
    installPluginFromCoreHub.mockResolvedValue(
      createCoreHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "official",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(installedCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: installedCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "corehub:demo"]);

    expect(installPluginFromCoreHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "corehub:demo",
        policy,
      }),
    );
    expect(recordPluginInstall).toHaveBeenCalledWith(
      enabledCfg,
      expect.objectContaining({
        pluginId: "demo",
        source: "corehub",
        spec: "corehub:demo@1.2.3",
        corehubPackage: "demo",
        corehubFamily: "code-plugin",
        corehubChannel: "official",
        corehubVerificationTier: "source-linked",
        artifactSha256: "abc",
        artifactManifestVerified: true,
        artifactManifestSha256: "manifest-abc",
        artifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
        publisherHandle: "coreblow",
      }),
    );
    expect(writeConfigFile).toHaveBeenCalledWith(installedCfg);
    expect(buildPluginStatusReport).not.toHaveBeenCalled();
    expect(runtimeLogs.some((line) => line.includes("Installed plugin: demo"))).toBe(true);
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
  });

  it("previews CoreHub plugin installs with --dry-run without persisting config", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as CoreBlowConfig;

    loadConfig.mockReturnValue(cfg);
    parseCoreHubPluginSpec.mockReturnValue({ name: "demo" });
    installPluginFromCoreHub.mockResolvedValue(
      createCoreHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "official",
      }),
    );

    await runPluginsCommand(["plugins", "install", "corehub:demo", "--dry-run"]);

    expect(installPluginFromCoreHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "corehub:demo",
        dryRun: true,
      }),
    );
    expect(clearPluginManifestRegistryCache).not.toHaveBeenCalled();
    expect(recordPluginInstall).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(runtimeLogs.some((line) => line.includes('Dry run: would install plugin "demo"'))).toBe(
      true,
    );
    expect(runtimeLogs.some((line) => line.includes("corehub:demo@1.2.3"))).toBe(true);
  });

  it("prefers CoreHub before npm for bare plugin specs", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as CoreBlowConfig;
    const enabledCfg = createEnabledPluginConfig("demo");
    const installedCfg = createCoreHubInstalledConfig({
      pluginId: "demo",
      install: {
        source: "corehub",
        spec: "corehub:demo@1.2.3",
        installPath: "/tmp/coreblow-state/extensions/demo",
        corehubPackage: "demo",
      },
    });

    loadConfig.mockReturnValue(cfg);
    installPluginFromCoreHub.mockResolvedValue(
      createCoreHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "community",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(installedCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: installedCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "demo"]);

    expect(installPluginFromCoreHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "corehub:demo",
      }),
    );
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(writeConfigFile).toHaveBeenCalledWith(installedCfg);
  });

  it("falls back to npm when CoreHub does not have the package", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as CoreBlowConfig;
    const enabledCfg = {
      plugins: {
        entries: {
          demo: {
            enabled: true,
          },
        },
      },
    } as CoreBlowConfig;

    loadConfig.mockReturnValue(cfg);
    installPluginFromCoreHub.mockResolvedValue({
      ok: false,
      error: "CoreHub /api/v1/packages/demo failed (404): Package not found",
      code: "package_not_found",
    });
    installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/coreblow-state/extensions/demo",
      version: "1.2.3",
      npmResolution: {
        packageName: "demo",
        resolvedVersion: "1.2.3",
        tarballUrl: "https://registry.npmjs.org/demo/-/demo-1.2.3.tgz",
      },
    });
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(enabledCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "demo"]);

    expect(installPluginFromCoreHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "corehub:demo",
      }),
    );
    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "demo",
      }),
    );
  });

  it("does not fall back to npm when CoreHub rejects a real package", async () => {
    installPluginFromCoreHub.mockResolvedValue({
      ok: false,
      error: 'Use "coreblow skills install demo" instead.',
      code: "skill_package",
    });

    await expect(runPluginsCommand(["plugins", "install", "demo"])).rejects.toThrow("__exit__:1");

    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain('Use "coreblow skills install demo" instead.');
  });

  it("falls back to installing hook packs from npm specs", async () => {
    const cfg = {} as CoreBlowConfig;
    const installedCfg = {
      hooks: {
        internal: {
          installs: {
            "demo-hooks": {
              source: "npm",
              spec: "@acme/demo-hooks@1.2.3",
            },
          },
        },
      },
    } as CoreBlowConfig;

    loadConfig.mockReturnValue(cfg);
    installPluginFromCoreHub.mockResolvedValue({
      ok: false,
      error: "CoreHub /api/v1/packages/@acme/demo-hooks failed (404): Package not found",
      code: "package_not_found",
    });
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "package.json missing coreblow.plugin.json",
    });
    installHooksFromNpmSpec.mockResolvedValue({
      ok: true,
      hookPackId: "demo-hooks",
      hooks: ["command-audit"],
      targetDir: "/tmp/hooks/demo-hooks",
      version: "1.2.3",
      npmResolution: {
        name: "@acme/demo-hooks",
        spec: "@acme/demo-hooks@1.2.3",
        integrity: "sha256-demo",
      },
    });
    recordHookInstall.mockReturnValue(installedCfg);

    await runPluginsCommand(["plugins", "install", "@acme/demo-hooks"]);

    expect(installHooksFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "@acme/demo-hooks",
      }),
    );
    expect(recordHookInstall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hookId: "demo-hooks",
        hooks: ["command-audit"],
      }),
    );
    expect(writeConfigFile).toHaveBeenCalledWith(installedCfg);
    expect(runtimeLogs.some((line) => line.includes("Installed hook pack: demo-hooks"))).toBe(true);
  });
});
