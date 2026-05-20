import fs from "node:fs";
import { buildNpmInstallRecordFields } from "../../cli/npm-resolution.js";
import {
  buildPreferredCoreHubSpec,
  createPluginInstallLogger,
  decidePreferredCoreHubFallback,
  resolveFileNpmSpecToLocalPath,
} from "../../cli/plugins-command-helpers.js";
import { persistPluginInstall } from "../../cli/plugins-install-persist.js";
import {
  readConfigFileSnapshot,
  validateConfigObjectWithPlugins,
  writeConfigFile,
} from "../../config/config.js";
import type { CoreBlowConfig } from "../../config/config.js";
import type { PluginInstallRecord } from "../../config/types.plugins.js";
import { resolveArchiveKind } from "../../infra/archive.js";
import { parseCoreHubPluginSpec } from "../../infra/coreblow-hub.js";
import { installPluginFromCoreHub } from "../../plugins/coreblow-hub.js";
import { installPluginFromNpmSpec, installPluginFromPath } from "../../plugins/install.js";
import { clearPluginManifestRegistryCache } from "../../plugins/manifest-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import {
  buildAllPluginInspectReports,
  buildPluginInspectReport,
  buildPluginStatusReport,
  formatPluginCompatibilityNotice,
  type PluginStatusReport,
} from "../../plugins/status.js";
import { setPluginEnabledInConfig } from "../../plugins/toggle-config.js";
import { resolveUserPath } from "../../utils.js";
import { isInternalMessageChannel } from "../../utils/message-channel.js";
import {
  rejectNonOwnerCommand,
  rejectUnauthorizedCommand,
  requireCommandFlagEnabled,
  requireGatewayClientScopeForInternalChannel,
} from "./command-gates.js";
import type { CommandHandler } from "./commands-types.js";
import { parsePluginsCommand } from "./plugins-commands.js";

function renderJsonBlock(label: string, value: unknown): string {
  return `${label}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function buildPluginInspectJson(params: {
  id: string;
  config: CoreBlowConfig;
  report: PluginStatusReport;
}): {
  inspect: NonNullable<ReturnType<typeof buildPluginInspectReport>>;
  compatibilityWarnings: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  install: PluginInstallRecord | null;
} | null {
  const inspect = buildPluginInspectReport({
    id: params.id,
    config: params.config,
    report: params.report,
  });
  if (!inspect) {
    return null;
  }
  return {
    inspect,
    compatibilityWarnings: inspect.compatibility.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: formatPluginCompatibilityNotice(warning),
    })),
    install: params.config.plugins?.installs?.[inspect.plugin.id] ?? null,
  };
}

function buildAllPluginInspectJson(params: {
  config: CoreBlowConfig;
  report: PluginStatusReport;
}): Array<{
  inspect: ReturnType<typeof buildAllPluginInspectReports>[number];
  compatibilityWarnings: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  install: PluginInstallRecord | null;
}> {
  return buildAllPluginInspectReports({
    config: params.config,
    report: params.report,
  }).map((inspect) => ({
    inspect,
    compatibilityWarnings: inspect.compatibility.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: formatPluginCompatibilityNotice(warning),
    })),
    install: params.config.plugins?.installs?.[inspect.plugin.id] ?? null,
  }));
}

function formatPluginLabel(plugin: PluginRecord): string {
  if (!plugin.name || plugin.name === plugin.id) {
    return plugin.id;
  }
  return `${plugin.name} (${plugin.id})`;
}

function formatPluginsList(report: PluginStatusReport): string {
  if (report.plugins.length === 0) {
    return `🔌 No plugins found for workspace ${report.workspaceDir ?? "(unknown workspace)"}.`;
  }

  const loaded = report.plugins.filter((plugin) => plugin.status === "loaded").length;
  const lines = [
    `🔌 Plugins (${loaded}/${report.plugins.length} loaded)`,
    ...report.plugins.map((plugin) => {
      const format = plugin.bundleFormat
        ? `${plugin.format ?? "coreblow"}/${plugin.bundleFormat}`
        : (plugin.format ?? "coreblow");
      return `- ${formatPluginLabel(plugin)} [${plugin.status}] ${format}`;
    }),
  ];
  return lines.join("\n");
}

function findPlugin(report: PluginStatusReport, rawName: string): PluginRecord | undefined {
  const target = rawName.trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  return report.plugins.find(
    (plugin) => plugin.id.toLowerCase() === target || plugin.name.toLowerCase() === target,
  );
}

function looksLikeLocalPluginInstallSpec(raw: string): boolean {
  return (
    raw.startsWith(".") ||
    raw.startsWith("~") ||
    raw.startsWith("/") ||
    raw.endsWith(".ts") ||
    raw.endsWith(".js") ||
    raw.endsWith(".mjs") ||
    raw.endsWith(".cjs") ||
    raw.endsWith(".tgz") ||
    raw.endsWith(".tar.gz") ||
    raw.endsWith(".tar") ||
    raw.endsWith(".zip")
  );
}

async function installPluginFromPluginsCommand(params: {
  raw: string;
  config: CoreBlowConfig;
}): Promise<{ ok: true; pluginId: string } | { ok: false; error: string }> {
  const fileSpec = resolveFileNpmSpecToLocalPath(params.raw);
  if (fileSpec && !fileSpec.ok) {
    return { ok: false, error: fileSpec.error };
  }
  const normalized = fileSpec && fileSpec.ok ? fileSpec.path : params.raw;
  const resolved = resolveUserPath(normalized);

  if (fs.existsSync(resolved)) {
    const result = await installPluginFromPath({
      path: resolved,
      logger: createPluginInstallLogger(),
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    clearPluginManifestRegistryCache();
    const source: "archive" | "path" = resolveArchiveKind(resolved) ? "archive" : "path";
    await persistPluginInstall({
      config: params.config,
      pluginId: result.pluginId,
      install: {
        source,
        sourcePath: resolved,
        installPath: result.targetDir,
        version: result.version,
      },
    });
    return { ok: true, pluginId: result.pluginId };
  }

  if (looksLikeLocalPluginInstallSpec(params.raw)) {
    return { ok: false, error: `Path not found: ${resolved}` };
  }

  const corehubSpec = parseCoreHubPluginSpec(params.raw);
  if (corehubSpec) {
    const result = await installPluginFromCoreHub({
      spec: params.raw,
      logger: createPluginInstallLogger(),
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    clearPluginManifestRegistryCache();
    await persistPluginInstall({
      config: params.config,
      pluginId: result.pluginId,
      install: {
        source: "corehub",
        spec: params.raw,
        installPath: result.targetDir,
        version: result.version,
        integrity: result.corehub.integrity,
        resolvedAt: result.corehub.resolvedAt,
        corehubUrl: result.corehub.corehubUrl,
        corehubPackage: result.corehub.corehubPackage,
        corehubFamily: result.corehub.corehubFamily,
        corehubChannel: result.corehub.corehubChannel,
        artifactSha256: result.corehub.artifactSha256,
        artifactSize: result.corehub.artifactSize,
        artifactManifestVerified: result.corehub.artifactManifestVerified,
        artifactManifestSha256: result.corehub.artifactManifestSha256,
        artifactStorageKey: result.corehub.artifactStorageKey,
        publisherHandle: result.corehub.publisherHandle,
        verifiedAt: result.corehub.verifiedAt,
      },
    });
    return { ok: true, pluginId: result.pluginId };
  }

  const preferredCoreHubSpec = buildPreferredCoreHubSpec(params.raw);
  if (preferredCoreHubSpec) {
    const corehubResult = await installPluginFromCoreHub({
      spec: preferredCoreHubSpec,
      logger: createPluginInstallLogger(),
    });
    if (corehubResult.ok) {
      clearPluginManifestRegistryCache();
      await persistPluginInstall({
        config: params.config,
        pluginId: corehubResult.pluginId,
        install: {
          source: "corehub",
          spec: preferredCoreHubSpec,
          installPath: corehubResult.targetDir,
          version: corehubResult.version,
          integrity: corehubResult.corehub.integrity,
          resolvedAt: corehubResult.corehub.resolvedAt,
          corehubUrl: corehubResult.corehub.corehubUrl,
          corehubPackage: corehubResult.corehub.corehubPackage,
          corehubFamily: corehubResult.corehub.corehubFamily,
          corehubChannel: corehubResult.corehub.corehubChannel,
          artifactSha256: corehubResult.corehub.artifactSha256,
          artifactSize: corehubResult.corehub.artifactSize,
          artifactManifestVerified: corehubResult.corehub.artifactManifestVerified,
          artifactManifestSha256: corehubResult.corehub.artifactManifestSha256,
          artifactStorageKey: corehubResult.corehub.artifactStorageKey,
          publisherHandle: corehubResult.corehub.publisherHandle,
          verifiedAt: corehubResult.corehub.verifiedAt,
        },
      });
      return { ok: true, pluginId: corehubResult.pluginId };
    }
    if (decidePreferredCoreHubFallback(corehubResult) !== "fallback_to_npm") {
      return { ok: false, error: corehubResult.error };
    }
  }

  const result = await installPluginFromNpmSpec({
    spec: params.raw,
    logger: createPluginInstallLogger(),
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  clearPluginManifestRegistryCache();
  const installRecord = buildNpmInstallRecordFields({
    spec: params.raw,
    installPath: result.targetDir,
    version: result.version,
    resolution: result.npmResolution,
  });
  await persistPluginInstall({
    config: params.config,
    pluginId: result.pluginId,
    install: installRecord,
  });
  return { ok: true, pluginId: result.pluginId };
}

async function loadPluginCommandState(workspaceDir: string): Promise<
  | {
      ok: true;
      path: string;
      config: CoreBlowConfig;
      report: PluginStatusReport;
    }
  | { ok: false; path: string; error: string }
> {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    return {
      ok: false,
      path: snapshot.path,
      error: "Config file is invalid; fix it before using /plugins.",
    };
  }
  const config = structuredClone(snapshot.resolved);
  return {
    ok: true,
    path: snapshot.path,
    config,
    report: buildPluginStatusReport({ config, workspaceDir }),
  };
}

export const handlePluginsCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const pluginsCommand = parsePluginsCommand(params.command.commandBodyNormalized);
  if (!pluginsCommand) {
    return null;
  }
  const unauthorized = rejectUnauthorizedCommand(params, "/plugins");
  if (unauthorized) {
    return unauthorized;
  }
  const allowInternalReadOnly =
    (pluginsCommand.action === "list" || pluginsCommand.action === "inspect") &&
    isInternalMessageChannel(params.command.channel);
  const nonOwner = allowInternalReadOnly ? null : rejectNonOwnerCommand(params, "/plugins");
  if (nonOwner) {
    return nonOwner;
  }
  const disabled = requireCommandFlagEnabled(params.cfg, {
    label: "/plugins",
    configKey: "plugins",
  });
  if (disabled) {
    return disabled;
  }
  if (pluginsCommand.action === "error") {
    return {
      shouldContinue: false,
      reply: { text: `⚠️ ${pluginsCommand.message}` },
    };
  }

  const loaded = await loadPluginCommandState(params.workspaceDir);
  if (!loaded.ok) {
    return {
      shouldContinue: false,
      reply: { text: `⚠️ ${loaded.error}` },
    };
  }

  if (pluginsCommand.action === "list") {
    return {
      shouldContinue: false,
      reply: { text: formatPluginsList(loaded.report) },
    };
  }

  if (pluginsCommand.action === "inspect") {
    if (!pluginsCommand.name) {
      return {
        shouldContinue: false,
        reply: { text: formatPluginsList(loaded.report) },
      };
    }
    if (pluginsCommand.name.toLowerCase() === "all") {
      return {
        shouldContinue: false,
        reply: {
          text: renderJsonBlock("🔌 Plugins", buildAllPluginInspectJson(loaded)),
        },
      };
    }
    const payload = buildPluginInspectJson({
      id: pluginsCommand.name,
      config: loaded.config,
      report: loaded.report,
    });
    if (!payload) {
      return {
        shouldContinue: false,
        reply: { text: `🔌 No plugin named "${pluginsCommand.name}" found.` },
      };
    }
    return {
      shouldContinue: false,
      reply: {
        text: renderJsonBlock(`🔌 Plugin "${payload.inspect.plugin.id}"`, {
          ...payload.inspect,
          compatibilityWarnings: payload.compatibilityWarnings,
          install: payload.install,
        }),
      },
    };
  }

  const missingAdminScope = requireGatewayClientScopeForInternalChannel(params, {
    label: "/plugins write",
    allowedScopes: ["operator.admin"],
    missingText: "❌ /plugins install|enable|disable requires operator.admin for gateway clients.",
  });
  if (missingAdminScope) {
    return missingAdminScope;
  }

  if (pluginsCommand.action === "install") {
    const installed = await installPluginFromPluginsCommand({
      raw: pluginsCommand.spec,
      config: structuredClone(loaded.config),
    });
    if (!installed.ok) {
      return {
        shouldContinue: false,
        reply: { text: `⚠️ ${installed.error}` },
      };
    }
    return {
      shouldContinue: false,
      reply: {
        text: `🔌 Installed plugin "${installed.pluginId}". Restart the gateway to load plugins.`,
      },
    };
  }

  const plugin = findPlugin(loaded.report, pluginsCommand.name);
  if (!plugin) {
    return {
      shouldContinue: false,
      reply: { text: `🔌 No plugin named "${pluginsCommand.name}" found.` },
    };
  }

  const next = setPluginEnabledInConfig(
    structuredClone(loaded.config),
    plugin.id,
    pluginsCommand.action === "enable",
  );
  const validated = validateConfigObjectWithPlugins(next);
  if (!validated.ok) {
    const issue = validated.issues[0];
    return {
      shouldContinue: false,
      reply: {
        text: `⚠️ Config invalid after /plugins ${pluginsCommand.action} (${issue.path}: ${issue.message}).`,
      },
    };
  }
  await writeConfigFile(validated.config);

  return {
    shouldContinue: false,
    reply: {
      text: `🔌 Plugin "${plugin.id}" ${pluginsCommand.action}d in ${loaded.path}. Restart the gateway to apply.`,
    },
  };
};
