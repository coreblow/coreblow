import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { i18n } from "../infra/i18n/index.js";
import {
  buildPluginStatusReport,
  enablePluginInConfig,
  loadConfig,
  parseCoreHubPluginSpec,
  promptYesNo,
  resetPluginsCliTestState,
  runPluginsCommand,
  runtimeErrors,
  runtimeLogs,
  uninstallPlugin,
  writeConfigFile,
} from "./plugins-cli-test-helpers.js";

describe("plugins cli uninstall", () => {
  beforeEach(() => {
    resetPluginsCliTestState();
  });

  afterEach(async () => {
    await i18n.setLocale("en");
  });

  it("localizes plugin enable output", async () => {
    await i18n.setLocale("id");
    loadConfig.mockReturnValue({} as CoreBlowConfig);
    enablePluginInConfig.mockReturnValue({
      config: {
        plugins: {
          entries: {
            alpha: { enabled: true },
          },
        },
      },
      enabled: true,
    });

    await runPluginsCommand(["plugins", "enable", "alpha"]);

    expect(runtimeLogs.some((line) => line.includes('Plugin "alpha" diaktifkan'))).toBe(true);
  });

  it("shows uninstall dry-run preview without mutating config", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        entries: {
          alpha: {
            enabled: true,
          },
        },
        installs: {
          alpha: {
            source: "path",
            sourcePath: "/tmp/coreblow-state/extensions/alpha",
            installPath: "/tmp/coreblow-state/extensions/alpha",
          },
        },
      },
    } as CoreBlowConfig);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "alpha", name: "alpha" }],
      diagnostics: [],
    });

    await runPluginsCommand(["plugins", "uninstall", "alpha", "--dry-run"]);

    expect(uninstallPlugin).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(runtimeLogs.some((line) => line.includes("Dry run, no changes made."))).toBe(true);
  });

  it("uninstalls with --force and --keep-files without prompting", async () => {
    const baseConfig = {
      plugins: {
        entries: {
          alpha: { enabled: true },
        },
        installs: {
          alpha: {
            source: "path",
            sourcePath: "/tmp/coreblow-state/extensions/alpha",
            installPath: "/tmp/coreblow-state/extensions/alpha",
          },
        },
      },
    } as CoreBlowConfig;
    const nextConfig = {
      plugins: {
        entries: {},
        installs: {},
      },
    } as CoreBlowConfig;

    loadConfig.mockReturnValue(baseConfig);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "alpha", name: "alpha" }],
      diagnostics: [],
    });
    uninstallPlugin.mockResolvedValue({
      ok: true,
      config: nextConfig,
      warnings: [],
      actions: {
        entry: true,
        install: true,
        allowlist: false,
        loadPath: false,
        memorySlot: false,
        directory: false,
      },
    });

    await runPluginsCommand(["plugins", "uninstall", "alpha", "--force", "--keep-files"]);

    expect(promptYesNo).not.toHaveBeenCalled();
    expect(uninstallPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "alpha",
        deleteFiles: false,
      }),
    );
    expect(writeConfigFile).toHaveBeenCalledWith(nextConfig);
    expect(
      runtimeLogs.some((line) =>
        line.includes('Plugin "alpha" uninstalled. Removed: config entry, install record.'),
      ),
    ).toBe(true);
  });

  it("localizes uninstall success output", async () => {
    await i18n.setLocale("id");
    const baseConfig = {
      plugins: {
        entries: {
          alpha: { enabled: true },
        },
        installs: {
          alpha: {
            source: "path",
            sourcePath: "/tmp/coreblow-state/extensions/alpha",
            installPath: "/tmp/coreblow-state/extensions/alpha",
          },
        },
      },
    } as CoreBlowConfig;
    const nextConfig = {
      plugins: {
        entries: {},
        installs: {},
      },
    } as CoreBlowConfig;

    loadConfig.mockReturnValue(baseConfig);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "alpha", name: "alpha" }],
      diagnostics: [],
    });
    uninstallPlugin.mockResolvedValue({
      ok: true,
      config: nextConfig,
      warnings: [],
      actions: {
        entry: true,
        install: true,
        allowlist: false,
        loadPath: false,
        memorySlot: false,
        directory: false,
      },
    });

    await runPluginsCommand(["plugins", "uninstall", "alpha", "--force", "--keep-files"]);

    expect(
      runtimeLogs.some((line) =>
        line.includes('Plugin "alpha" dihapus. Dihapus: config entry, install record.'),
      ),
    ).toBe(true);
    expect(
      runtimeLogs.some((line) => line.includes("Mulai ulang gateway untuk menerapkan perubahan.")),
    ).toBe(true);
  });

  it("exits when uninstall target is not managed by plugin install records", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        entries: {},
        installs: {},
      },
    } as CoreBlowConfig);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "alpha", name: "alpha" }],
      diagnostics: [],
    });

    await expect(runPluginsCommand(["plugins", "uninstall", "alpha", "--force"])).rejects.toThrow(
      "__exit__:1",
    );

    expect(runtimeErrors.at(-1)).toContain("is not managed by plugins config/install records");
    expect(uninstallPlugin).not.toHaveBeenCalled();
  });

  it("accepts the recorded CoreHub spec as an uninstall target", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        entries: {
          "linkmind-context": { enabled: true },
        },
        installs: {
          "linkmind-context": {
            source: "npm",
            spec: "corehub:linkmind-context",
            corehubPackage: "linkmind-context",
          },
        },
      },
    } as CoreBlowConfig);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "linkmind-context", name: "linkmind-context" }],
      diagnostics: [],
    });
    parseCoreHubPluginSpec.mockImplementation((raw: string) =>
      raw === "corehub:linkmind-context" ? { name: "linkmind-context" } : null,
    );

    await runPluginsCommand(["plugins", "uninstall", "corehub:linkmind-context", "--force"]);

    expect(uninstallPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "linkmind-context",
      }),
    );
  });

  it("accepts a versionless CoreHub spec when the install was pinned", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        entries: {
          "linkmind-context": { enabled: true },
        },
        installs: {
          "linkmind-context": {
            source: "npm",
            spec: "corehub:linkmind-context@1.2.3",
          },
        },
      },
    } as CoreBlowConfig);
    buildPluginStatusReport.mockReturnValue({
      plugins: [{ id: "linkmind-context", name: "linkmind-context" }],
      diagnostics: [],
    });
    parseCoreHubPluginSpec.mockImplementation((raw: string) => {
      if (raw === "corehub:linkmind-context") {
        return { name: "linkmind-context" };
      }
      if (raw === "corehub:linkmind-context@1.2.3") {
        return { name: "linkmind-context", version: "1.2.3" };
      }
      return null;
    });

    await runPluginsCommand(["plugins", "uninstall", "corehub:linkmind-context", "--force"]);

    expect(uninstallPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "linkmind-context",
      }),
    );
  });
});
