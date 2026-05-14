import { Command } from "commander";
import { type Mock, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { createCliRuntimeCapture } from "./test-runtime-capture.js";

export const loadConfig = vi.fn(() => ({}) as CoreBlowConfig);
export const readConfigFileSnapshot: Mock = vi.fn();
export const writeConfigFile = vi.fn(
  async (_config?: CoreBlowConfig) => undefined,
);
export const resolveStateDir: Mock = vi.fn(() => "/tmp/coreblow-state");
export const installPluginFromMarketplace: Mock = vi.fn();
export const listMarketplacePlugins: Mock = vi.fn();
export const resolveMarketplaceInstallShortcut: Mock = vi.fn();
export const enablePluginInConfig: Mock = vi.fn();
export const recordPluginInstall: Mock = vi.fn();
export const clearPluginManifestRegistryCache: Mock = vi.fn();
export const buildPluginStatusReport: Mock = vi.fn();
export const applyExclusiveSlotSelection: Mock = vi.fn();
export const uninstallPlugin: Mock = vi.fn();
export const updateNpmInstalledPlugins: Mock = vi.fn();
export const updateNpmInstalledHookPacks: Mock = vi.fn();
export const promptYesNo: Mock = vi.fn();
export const installPluginFromNpmSpec: Mock = vi.fn();
export const installPluginFromPath: Mock = vi.fn();
export const installPluginFromCoreHub: Mock = vi.fn();
export const parseCoreHubPluginSpec: Mock = vi.fn();
export const installHooksFromNpmSpec: Mock = vi.fn();
export const installHooksFromPath: Mock = vi.fn();
export const recordHookInstall: Mock = vi.fn();

const { defaultRuntime, runtimeLogs, runtimeErrors, resetRuntimeCapture } =
  createCliRuntimeCapture();

export { runtimeErrors, runtimeLogs };

vi.mock("../runtime.js", () => ({
  defaultRuntime,
}));

vi.mock("../config/config.js", () => ({
  loadConfig: () => loadConfig(),
  readConfigFileSnapshot: () => readConfigFileSnapshot(),
  writeConfigFile: (config: CoreBlowConfig) => writeConfigFile(config),
}));

vi.mock("../config/paths.js", () => ({
  resolveStateDir: () => resolveStateDir(),
}));

vi.mock("../plugins/marketplace.js", () => ({
  installPluginFromMarketplace: (...args: unknown[]) => installPluginFromMarketplace(...args),
  listMarketplacePlugins: (...args: unknown[]) => listMarketplacePlugins(...args),
  resolveMarketplaceInstallShortcut: (...args: unknown[]) =>
    resolveMarketplaceInstallShortcut(...args),
}));

vi.mock("../plugins/enable.js", () => ({
  enablePluginInConfig: (...args: unknown[]) => enablePluginInConfig(...args),
}));

vi.mock("../plugins/installs.js", () => ({
  recordPluginInstall: (...args: unknown[]) => recordPluginInstall(...args),
}));

vi.mock("../plugins/manifest-registry.js", () => ({
  clearPluginManifestRegistryCache: () => clearPluginManifestRegistryCache(),
}));

vi.mock("../plugins/status.js", () => ({
  buildPluginStatusReport: (...args: unknown[]) => buildPluginStatusReport(...args),
}));

vi.mock("../plugins/slots.js", () => ({
  applyExclusiveSlotSelection: (...args: unknown[]) => applyExclusiveSlotSelection(...args),
}));

vi.mock("../plugins/uninstall.js", () => ({
  uninstallPlugin: (...args: unknown[]) => uninstallPlugin(...args),
  resolveUninstallDirectoryTarget: ({
    installRecord,
  }: {
    installRecord?: { installPath?: string; sourcePath?: string };
  }) => installRecord?.installPath ?? installRecord?.sourcePath ?? null,
}));

vi.mock("../plugins/update.js", () => ({
  updateNpmInstalledPlugins: (...args: unknown[]) => updateNpmInstalledPlugins(...args),
}));

vi.mock("../hooks/update.js", () => ({
  updateNpmInstalledHookPacks: (...args: unknown[]) => updateNpmInstalledHookPacks(...args),
}));

vi.mock("./prompt.js", () => ({
  promptYesNo: (...args: unknown[]) => promptYesNo(...args),
}));

vi.mock("../plugins/install.js", () => ({
  PLUGIN_INSTALL_ERROR_CODE: {
    NPM_PACKAGE_NOT_FOUND: "npm_package_not_found",
  },
  installPluginFromNpmSpec: (...args: unknown[]) => installPluginFromNpmSpec(...args),
  installPluginFromPath: (...args: unknown[]) => installPluginFromPath(...args),
}));

vi.mock("../hooks/install.js", () => ({
  installHooksFromNpmSpec: (...args: unknown[]) => installHooksFromNpmSpec(...args),
  installHooksFromPath: (...args: unknown[]) => installHooksFromPath(...args),
  resolveHookInstallDir: (hookId: string) => `/tmp/hooks/${hookId}`,
}));

vi.mock("../hooks/installs.js", () => ({
  recordHookInstall: (...args: unknown[]) => recordHookInstall(...args),
}));

vi.mock("../plugins/coreblow-hub.js", () => ({
  COREHUB_INSTALL_ERROR_CODE: {
    PACKAGE_NOT_FOUND: "package_not_found",
    VERSION_NOT_FOUND: "version_not_found",
  },
  installPluginFromCoreHub: (...args: unknown[]) => installPluginFromCoreHub(...args),
  formatCoreHubSpecifier: ({ name, version }: { name: string; version?: string }) =>
    `corehub:${name}${version ? `@${version}` : ""}`,
}));

vi.mock("../infra/coreblow-hub.js", () => ({
  parseCoreHubPluginSpec: (...args: unknown[]) => parseCoreHubPluginSpec(...args),
}));

const { registerPluginsCli } = await import("./plugins-cli.js");

export function runPluginsCommand(argv: string[]) {
  const program = new Command();
  program.exitOverride();
  registerPluginsCli(program);
  return program.parseAsync(argv, { from: "user" });
}

export function resetPluginsCliTestState() {
  resetRuntimeCapture();
  loadConfig.mockReset();
  readConfigFileSnapshot.mockReset();
  writeConfigFile.mockReset();
  resolveStateDir.mockReset();
  installPluginFromMarketplace.mockReset();
  listMarketplacePlugins.mockReset();
  resolveMarketplaceInstallShortcut.mockReset();
  enablePluginInConfig.mockReset();
  recordPluginInstall.mockReset();
  clearPluginManifestRegistryCache.mockReset();
  buildPluginStatusReport.mockReset();
  applyExclusiveSlotSelection.mockReset();
  uninstallPlugin.mockReset();
  updateNpmInstalledPlugins.mockReset();
  updateNpmInstalledHookPacks.mockReset();
  promptYesNo.mockReset();
  installPluginFromNpmSpec.mockReset();
  installPluginFromPath.mockReset();
  installPluginFromCoreHub.mockReset();
  parseCoreHubPluginSpec.mockReset();
  installHooksFromNpmSpec.mockReset();
  installHooksFromPath.mockReset();
  recordHookInstall.mockReset();

  loadConfig.mockReturnValue({} as CoreBlowConfig);
  readConfigFileSnapshot.mockResolvedValue({
    path: "/tmp/coreblow-config.json5",
    exists: true,
    raw: "{}",
    parsed: {},
    resolved: {},
    valid: true,
    config: {} as CoreBlowConfig,
    hash: "mock",
    issues: [],
    warnings: [],
    legacyIssues: [],
  });
  writeConfigFile.mockResolvedValue(undefined);
  resolveStateDir.mockReturnValue("/tmp/coreblow-state");
  resolveMarketplaceInstallShortcut.mockResolvedValue(null);
  installPluginFromMarketplace.mockResolvedValue({
    ok: false,
    error: "marketplace install failed",
  });
  enablePluginInConfig.mockImplementation((cfg: CoreBlowConfig) => ({ config: cfg }));
  recordPluginInstall.mockImplementation((cfg: CoreBlowConfig) => cfg);
  buildPluginStatusReport.mockReturnValue({
    plugins: [],
    diagnostics: [],
  });
  applyExclusiveSlotSelection.mockImplementation(({ config }: { config: CoreBlowConfig }) => ({
    config,
    warnings: [],
  }));
  uninstallPlugin.mockResolvedValue({
    ok: true,
    config: {} as CoreBlowConfig,
    warnings: [],
    actions: {
      entry: false,
      install: false,
      allowlist: false,
      loadPath: false,
      memorySlot: false,
      directory: false,
    },
  });
  updateNpmInstalledPlugins.mockResolvedValue({
    outcomes: [],
    changed: false,
    config: {} as CoreBlowConfig,
  });
  updateNpmInstalledHookPacks.mockResolvedValue({
    outcomes: [],
    changed: false,
    config: {} as CoreBlowConfig,
  });
  promptYesNo.mockResolvedValue(true);
  installPluginFromPath.mockResolvedValue({ ok: false, error: "path install disabled in test" });
  installPluginFromNpmSpec.mockResolvedValue({
    ok: false,
    error: "npm install disabled in test",
  });
  installPluginFromCoreHub.mockResolvedValue({
    ok: false,
    error: "corehub install disabled in test",
  });
  parseCoreHubPluginSpec.mockReturnValue(null);
  installHooksFromPath.mockResolvedValue({
    ok: false,
    error: "hook path install disabled in test",
  });
  installHooksFromNpmSpec.mockResolvedValue({
    ok: false,
    error: "hook npm install disabled in test",
  });
  recordHookInstall.mockImplementation((cfg: CoreBlowConfig) => cfg);
}
