import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";
import {
  AtomicPluginStageManager,
  CapabilityConsentLedger,
  type CoreHubAppManifest,
  type CoreHubCapability,
  type PluginLifecycleState,
  PluginLifecycleManager,
  type SafeActivationResult,
  safeActivatePlugin,
  validateCoreHubAppManifest,
} from "./app-store-contract.js";
import { type ExtensionTier, ExtensionTierPolicy } from "./extension-tier-policy.js";
import type { PluginRecord } from "./registry.js";
import {
  getActivePluginRegistry,
  listImportedRuntimePluginIds,
  recordImportedPluginId,
  requireActivePluginRegistry,
  unregisterImportedPluginId,
} from "./runtime.js";

function resolvePluginModuleExport(moduleExport: unknown): {
  definition?: { id?: string; name?: string; version?: string; kind?: string };
  register?: (api: any) => Promise<void> | void;
} {
  const resolved =
    moduleExport &&
    typeof moduleExport === "object" &&
    "default" in (moduleExport as Record<string, unknown>)
      ? (moduleExport as { default: unknown }).default
      : moduleExport;
  if (typeof resolved === "function") {
    return {
      register: resolved as (api: any) => Promise<void> | void,
    };
  }
  if (resolved && typeof resolved === "object") {
    const def = resolved as {
      id?: string;
      name?: string;
      version?: string;
      kind?: string;
      register?: (api: any) => Promise<void> | void;
      activate?: (api: any) => Promise<void> | void;
    };
    const register = def.register ?? def.activate;
    return { definition: def, register };
  }
  return {};
}

export interface AppStatusReport {
  readonly id: string;
  readonly tier: ExtensionTier;
  readonly lifecycleState: PluginLifecycleState;
  readonly consentedCapabilities: readonly CoreHubCapability[];
  readonly availableBackups: readonly string[];
}

export interface CoreHubAppStoreRuntimeOptions {
  baseDir?: string;
  stageManager?: AtomicPluginStageManager;
  consentLedger?: CapabilityConsentLedger;
  lifecycle?: PluginLifecycleManager;
  tierPolicy?: ExtensionTierPolicy;
}

export interface InstallAppFromBufferParams {
  archiveBuffer: Buffer;
  manifest: CoreHubAppManifest;
  grantCapabilities?: boolean;
  operator?: string;
}

export class CoreHubAppStoreRuntime implements GatewayService {
  public readonly name = "corehub-app-store";
  private isRunning = false;

  private readonly baseDir: string;
  private readonly stageManager: AtomicPluginStageManager;
  private readonly consentLedger: CapabilityConsentLedger;
  private readonly lifecycle: PluginLifecycleManager;
  private readonly tierPolicy: ExtensionTierPolicy;

  constructor(options: CoreHubAppStoreRuntimeOptions = {}) {
    this.baseDir = options.baseDir ?? path.join(os.homedir(), ".coreblow");
    this.stageManager = options.stageManager ?? new AtomicPluginStageManager({ baseDir: this.baseDir });
    this.consentLedger =
      options.consentLedger ?? new CapabilityConsentLedger({ baseDir: this.baseDir });
    this.lifecycle = options.lifecycle ?? new PluginLifecycleManager({ baseDir: this.baseDir });
    this.tierPolicy = options.tierPolicy ?? new ExtensionTierPolicy();
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    await this.tierPolicy.start();
    // Ensure base directories are initialized
    fs.mkdirSync(path.join(this.baseDir, "tmp"), { recursive: true });
    fs.mkdirSync(path.join(this.baseDir, "extensions"), { recursive: true });
    fs.mkdirSync(path.join(this.baseDir, "backups"), { recursive: true });
    fs.mkdirSync(path.join(this.baseDir, "plugins"), { recursive: true });
    // Recover from incomplete/interrupted staging state by cleaning orphaned tmp stages
    this.stageManager.cleanupOrphanedStages();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    await this.tierPolicy.stop();
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "CoreHub App Store runtime is stopped." };
    }
    return {
      status: "healthy",
      detail: "CoreHub App Store runtime active with 7-pillar contract enforcement.",
    };
  }

  public getConsentLedger(): CapabilityConsentLedger {
    return this.consentLedger;
  }

  public getLifecycleManager(): PluginLifecycleManager {
    return this.lifecycle;
  }

  public getStageManager(): AtomicPluginStageManager {
    return this.stageManager;
  }

  public getTierPolicy(): ExtensionTierPolicy {
    return this.tierPolicy;
  }

  public installAppFromBuffer(params: InstallAppFromBufferParams): {
    stageDir: string;
    targetDir: string;
    verifiedSha256: string;
  } {
    const { archiveBuffer, manifest, grantCapabilities, operator } = params;

    // 1. Stage and verify SHA-256 integrity
    const { stageDir, verifiedSha256 } = this.stageManager.stageArchive(
      manifest.id,
      archiveBuffer,
      manifest,
    );

    // 2. Commit staging into live extensions directory atomically
    const targetDir = this.stageManager.commitStagedPlugin(stageDir, manifest.id);

    // 3. Set lifecycle state
    this.lifecycle.transitionTo(manifest.id, "installed_disabled");

    // 4. Optionally grant requested capabilities
    if (grantCapabilities) {
      this.consentLedger.grantConsent(manifest.id, manifest.capabilities, operator ?? "operator");
    }

    return { stageDir, targetDir, verifiedSha256 };
  }

  public async enableApp(
    pluginId: string,
    manifest: CoreHubAppManifest,
    optionsOrFn?:
      | (() => Promise<void> | void)
      | { activateFn?: () => Promise<void> | void; forceImmediate?: boolean },
  ): Promise<SafeActivationResult> {
    const activateFn =
      typeof optionsOrFn === "function" ? optionsOrFn : optionsOrFn?.activateFn;
    const forceImmediate =
      typeof optionsOrFn === "object" && optionsOrFn !== null
        ? optionsOrFn.forceImmediate === true
        : false;

    // 1. Validate manifest schema first so invalid structures fail closed cleanly
    const manifestValidation = validateCoreHubAppManifest(manifest);
    if (!manifestValidation.valid) {
      throw new Error(
        `Activation blocked: invalid manifest for '${pluginId}': ${manifestValidation.errors.join(", ")}`,
      );
    }

    // 2. Check capability consent
    const consentCheck = this.consentLedger.checkConsent(manifest);
    if (!consentCheck.allowed) {
      const missing = consentCheck.missingCapabilities.join(", ");
      throw new Error(
        `Activation blocked: plugin '${pluginId}' requires unconsented capabilities [${missing}]. Grant consent via 'coreblow plugins consent ${pluginId} --grant <caps>' first.`,
      );
    }

    // 3. If plugin is not hot-reload safe and immediate activation is not forced,
    // schedule activation for next gateway restart without hot loading
    if (!manifest.hotReloadSafe && !forceImmediate) {
      return safeActivatePlugin({
        manifest,
        lifecycle: this.lifecycle,
        activateFn,
        forceImmediate,
      });
    }

    // 4. Locate installed package root safely
    const pluginDir = path.join(this.baseDir, "extensions", pluginId);
    if (!fs.existsSync(pluginDir)) {
      throw new Error(
        `Activation failed: installed package directory for '${pluginId}' not found at '${pluginDir}'`,
      );
    }

    // 4. Resolve package entrypoint
    let entryRelative = manifest.entrypoint;
    if (!entryRelative) {
      const pluginJsonPath = path.join(pluginDir, "coreblow.plugin.json");
      const pkgJsonPath = path.join(pluginDir, "package.json");
      if (fs.existsSync(pluginJsonPath)) {
        try {
          const pJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf8"));
          entryRelative = pJson.entryPoint ?? pJson.main;
        } catch {}
      } else if (fs.existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
          entryRelative = pkg.main ?? pkg.module;
        } catch {}
      }
    }

    if (!entryRelative) {
      if (fs.existsSync(path.join(pluginDir, "index.mjs"))) {
        entryRelative = "index.mjs";
      } else if (fs.existsSync(path.join(pluginDir, "index.js"))) {
        entryRelative = "index.js";
      } else if (fs.existsSync(path.join(pluginDir, "index.ts"))) {
        entryRelative = "index.ts";
      } else if (fs.existsSync(path.join(pluginDir, "package", "index.js"))) {
        entryRelative = "package/index.js";
      } else if (activateFn) {
        // Callback-only activation (for unit tests / mock harnesses without disk modules)
        return safeActivatePlugin({
          manifest,
          lifecycle: this.lifecycle,
          activateFn: async () => {
            recordImportedPluginId(pluginId);
            await Promise.resolve(activateFn());
          },
          forceImmediate,
        });
      } else {
        throw new Error(
          `Activation failed: no entrypoint specified and no index module found in '${pluginDir}'`,
        );
      }
    }

    let entryPath = path.resolve(pluginDir, entryRelative);
    const rel = path.relative(pluginDir, entryPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Activation failed: entrypoint '${entryRelative}' escapes plugin root directory`);
    }

    if (!fs.existsSync(entryPath)) {
      const nestedPackagePath = path.resolve(pluginDir, "package", entryRelative);
      if (fs.existsSync(nestedPackagePath)) {
        entryPath = nestedPackagePath;
      } else {
        throw new Error(`Activation failed: entrypoint module not found at '${entryPath}'`);
      }
    }

    // 5. Wrap dynamic module loading & registration in loader callback
    const wrappedActivateFn = async () => {
      let mod: unknown;
      try {
        const fileUrl = pathToFileURL(entryPath).href;
        mod = await import(fileUrl);
      } catch (importErr) {
        throw new Error(
          `Activation failed: dynamic import error for '${pluginId}': ${importErr instanceof Error ? importErr.message : String(importErr)}`,
        );
      }

      const { definition, register } = resolvePluginModuleExport(mod);
      if (typeof register !== "function") {
        throw new Error(
          `Activation failed: plugin '${pluginId}' entry module missing register or activate export`,
        );
      }

      const activeRegistry = requireActivePluginRegistry();
      const registeredTools: string[] = [];
      const registeredChannels: string[] = [];
      const registeredHooks: string[] = [];
      const registeredCommands: string[] = [];
      const registeredProviders: string[] = [];

      const pluginApi = {
        registerTool: (tool: any) => {
          tool.pluginId = pluginId;
          activeRegistry.tools.push(tool);
          registeredTools.push(tool.name ?? tool.id ?? "tool");
        },
        registerChannel: (channel: any) => {
          channel.pluginId = pluginId;
          activeRegistry.channels.push(channel);
          registeredChannels.push(channel.id ?? pluginId);
        },
        registerHook: (hook: any) => {
          hook.pluginId = pluginId;
          activeRegistry.hooks.push(hook);
          registeredHooks.push(hook.event ?? hook.name ?? "hook");
        },
        registerCommand: (command: any) => {
          command.pluginId = pluginId;
          activeRegistry.commands.push(command);
          registeredCommands.push(command.name ?? "cmd");
        },
        registerProvider: (provider: any) => {
          provider.pluginId = provider.pluginId ?? pluginId;
          activeRegistry.providers.push(provider);
          registeredProviders.push(provider.id ?? provider.name ?? "provider");
        },
      };

      await Promise.resolve(register(pluginApi));

      if (activateFn) {
        await Promise.resolve(activateFn());
      }

      const pluginRecord: PluginRecord = {
        id: pluginId,
        name: definition?.name ?? manifest.id,
        version: definition?.version ?? manifest.version,
        source: entryPath,
        origin: "global",
        enabled: true,
        status: "loaded",
        toolNames: registeredTools,
        hookNames: registeredHooks,
        channelIds: registeredChannels,
        cliBackendIds: [],
        providerIds: registeredProviders,
        speechProviderIds: [],
        mediaUnderstandingProviderIds: [],
        imageGenerationProviderIds: [],
        videoGenerationProviderIds: [],
        webSearchProviderIds: [],
        gatewayMethods: [],
        cliCommands: registeredCommands,
        services: [],
        commands: registeredCommands,
        httpRoutes: 0,
        hookCount: registeredHooks.length,
        configSchema: false,
      };

      activeRegistry.plugins = activeRegistry.plugins.filter((p) => p.id !== pluginId);
      activeRegistry.plugins.push(pluginRecord);

      recordImportedPluginId(pluginId);
    };

    return safeActivatePlugin({
      manifest,
      activateFn: wrappedActivateFn,
      lifecycle: this.lifecycle,
      forceImmediate,
    });
  }

  public disableApp(pluginId: string): void {
    this.lifecycle.transitionTo(pluginId, "installed_disabled");
    unregisterImportedPluginId(pluginId);
  }

  public snapshotBeforeUpdate(pluginId: string, currentVersion: string): string {
    this.lifecycle.transitionTo(pluginId, "updating");
    return this.lifecycle.snapshotBeforeUpdate(pluginId, currentVersion);
  }

  public rollbackApp(pluginId: string, targetVersion?: string): boolean {
    const ok = this.lifecycle.rollbackPlugin(pluginId, targetVersion);
    if (ok) {
      unregisterImportedPluginId(pluginId);
    }
    return ok;
  }

  public getAppStatusReport(pluginId: string): AppStatusReport {
    const tier = this.tierPolicy.getExtensionTier(pluginId);
    const lifecycleState = this.lifecycle.getState(pluginId);
    const consentRecord = this.consentLedger.getConsent(pluginId);
    const consentedCapabilities = consentRecord ? consentRecord.approvedCapabilities : [];

    const backupsDir = path.join(this.baseDir, "backups");
    let availableBackups: string[] = [];

    if (fs.existsSync(backupsDir)) {
      availableBackups = fs
        .readdirSync(backupsDir)
        .filter((entry) => entry.startsWith(`${pluginId}@`))
        .map((entry) => entry.slice(pluginId.length + 1))
        .sort()
        .reverse();
    }

    return {
      id: pluginId,
      tier,
      lifecycleState,
      consentedCapabilities,
      availableBackups: Object.freeze(availableBackups),
    };
  }

  public getInstalledAppIds(): string[] {
    return this.lifecycle.getInstalledPluginIds();
  }

  public getActivatedAppIds(): string[] {
    return this.lifecycle.getActivatedPluginIds();
  }

  public getLoadedAppIds(): string[] {
    const registry = getActivePluginRegistry();
    if (!registry) {
      return [];
    }
    const loadedRegistryPluginIds = new Set(
      registry.plugins
        .filter((p) => p.status === "loaded")
        .map((p) => p.id),
    );
    const importedIds = new Set(listImportedRuntimePluginIds());
    const activatedIds = this.lifecycle.getActivatedPluginIds();
    return activatedIds.filter(
      (id) => loadedRegistryPluginIds.has(id) && importedIds.has(id),
    );
  }
}
