import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { CoreBlowConfig } from "../config/config.js";
import { loadConfig, writeConfigFile } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import type { PluginCoreHubPolicyConfig, PluginInstallRecord } from "../config/types.plugins.js";
import {
  fetchCoreHubPackageDetail,
  fetchCoreHubPackageVersion,
  parseCoreHubPluginSpec,
} from "../infra/coreblow-hub.js";
import { t } from "../infra/i18n/index.js";
import { enablePluginInConfig } from "../plugins/enable.js";
import { listMarketplacePlugins } from "../plugins/marketplace.js";
import type { PluginRecord } from "../plugins/registry.js";
import { formatPluginSourceForTable, resolvePluginSourceRoots } from "../plugins/source-display.js";
import {
  buildAllPluginInspectReports,
  buildPluginCompatibilityNotices,
  buildPluginInspectReport,
  buildPluginStatusReport,
  formatPluginCompatibilityNotice,
} from "../plugins/status.js";
import {
  resolveUninstallChannelConfigKeys,
  resolveUninstallDirectoryTarget,
  uninstallPlugin,
} from "../plugins/uninstall.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { getTerminalTableWidth, renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";
import { shortenHomeInString, shortenHomePath } from "../utils.js";
import {
  applySlotSelectionForPlugin,
  createPluginInstallLogger,
  logSlotWarnings,
} from "./plugins-command-helpers.js";
import { setPluginEnabledInConfig } from "./plugins-config.js";
import { runPluginInstallCommand } from "./plugins-install-command.js";
import { runPluginUpdateCommand } from "./plugins-update-command.js";
import { promptYesNo } from "./prompt.js";

export type PluginsListOptions = {
  json?: boolean;
  enabled?: boolean;
  verbose?: boolean;
};

export type PluginInspectOptions = {
  json?: boolean;
  all?: boolean;
};

export type PluginVerifyOptions = {
  json?: boolean;
  refresh?: boolean;
};

export type PluginPolicyOptions = {
  json?: boolean;
};

export type PluginPolicyCheckOptions = {
  json?: boolean;
};

export type PluginPolicyAuditOptions = {
  json?: boolean;
  refresh?: boolean;
};

export type PluginUpdateOptions = {
  all?: boolean;
  dryRun?: boolean;
};

export type PluginMarketplaceListOptions = {
  json?: boolean;
};

export type PluginUninstallOptions = {
  keepFiles?: boolean;
  keepConfig?: boolean;
  force?: boolean;
  dryRun?: boolean;
};

function resolvePluginConfigId(params: {
  rawId: string;
  config: CoreBlowConfig;
  plugins: PluginRecord[];
}): { pluginId: string; plugin?: PluginRecord } {
  const rawId = params.rawId.trim();
  const plugin = params.plugins.find((entry) => entry.id === rawId || entry.name === rawId);
  if (plugin) {
    return { pluginId: plugin.id, plugin };
  }

  for (const [pluginId, install] of Object.entries(params.config.plugins?.installs ?? {})) {
    if (
      install.spec === rawId ||
      install.resolvedSpec === rawId ||
      install.resolvedName === rawId ||
      install.marketplacePlugin === rawId
    ) {
      return { pluginId };
    }
  }

  const requestedCoreHub = parseCoreHubPluginSpec(rawId);
  if (requestedCoreHub) {
    for (const [pluginId, install] of Object.entries(params.config.plugins?.installs ?? {})) {
      const installedCoreHubName =
        install.corehubPackage ??
        parseCoreHubPluginSpec(install.spec ?? "")?.name ??
        parseCoreHubPluginSpec(install.resolvedSpec ?? "")?.name;
      if (installedCoreHubName === requestedCoreHub.name) {
        return { pluginId };
      }
    }
  }

  return { pluginId: rawId };
}

function formatPluginLine(plugin: PluginRecord, verbose = false): string {
  const status =
    plugin.status === "loaded"
      ? theme.success("loaded")
      : plugin.status === "disabled"
        ? theme.warn("disabled")
        : theme.error("error");
  const name = theme.command(plugin.name || plugin.id);
  const idSuffix = plugin.name && plugin.name !== plugin.id ? theme.muted(` (${plugin.id})`) : "";
  const desc = plugin.description
    ? theme.muted(
        plugin.description.length > 60
          ? `${plugin.description.slice(0, 57)}...`
          : plugin.description,
      )
    : theme.muted("(no description)");
  const format = plugin.format ?? "coreblow";

  if (!verbose) {
    return `${name}${idSuffix} ${status} ${theme.muted(`[${format}]`)} - ${desc}`;
  }

  const parts = [
    `${name}${idSuffix} ${status}`,
    `  format: ${format}`,
    `  source: ${theme.muted(shortenHomeInString(plugin.source))}`,
    `  origin: ${plugin.origin}`,
  ];
  if (plugin.bundleFormat) {
    parts.push(`  bundle format: ${plugin.bundleFormat}`);
  }
  if (plugin.version) {
    parts.push(`  version: ${plugin.version}`);
  }
  if (plugin.providerIds.length > 0) {
    parts.push(`  providers: ${plugin.providerIds.join(", ")}`);
  }
  if (plugin.error) {
    parts.push(theme.error(`  error: ${plugin.error}`));
  }
  return parts.join("\n");
}

function formatInspectSection(title: string, lines: string[]): string[] {
  if (lines.length === 0) {
    return [];
  }
  return ["", theme.muted(`${title}:`), ...lines];
}

function formatCapabilityKinds(
  capabilities: Array<{
    kind: string;
  }>,
): string {
  if (capabilities.length === 0) {
    return "-";
  }
  return capabilities.map((entry) => entry.kind).join(", ");
}

function formatHookSummary(params: {
  usesLegacyBeforeAgentStart: boolean;
  typedHookCount: number;
  customHookCount: number;
}): string {
  const parts: string[] = [];
  if (params.usesLegacyBeforeAgentStart) {
    parts.push("before_agent_start");
  }
  const nonLegacyTypedHookCount =
    params.typedHookCount - (params.usesLegacyBeforeAgentStart ? 1 : 0);
  if (nonLegacyTypedHookCount > 0) {
    parts.push(`${nonLegacyTypedHookCount} typed`);
  }
  if (params.customHookCount > 0) {
    parts.push(`${params.customHookCount} custom`);
  }
  return parts.length > 0 ? parts.join(", ") : "-";
}

function formatInstallLines(install: PluginInstallRecord | undefined): string[] {
  if (!install) {
    return [];
  }
  const lines = [`Source: ${install.source}`];
  if (install.spec) {
    lines.push(`Spec: ${install.spec}`);
  }
  if (install.sourcePath) {
    lines.push(`Source path: ${shortenHomePath(install.sourcePath)}`);
  }
  if (install.installPath) {
    lines.push(`Install path: ${shortenHomePath(install.installPath)}`);
  }
  if (install.version) {
    lines.push(`Recorded version: ${install.version}`);
  }
  if (install.installedAt) {
    lines.push(`Installed at: ${install.installedAt}`);
  }
  return lines;
}

type PluginTrustProof = {
  corehubPackage: string;
  corehubUrl?: string;
  version?: string;
  publisherHandle?: string;
  corehubVerificationTier?: string;
  artifactSha256?: string;
  artifactSize?: number;
  artifactManifestVerified?: boolean;
  artifactManifestSha256?: string;
  artifactStorageKey?: string;
  integrity?: string;
  verifiedAt?: string;
  resolvedAt?: string;
  previousVersion?: string;
  previousArtifactSha256?: string;
  previousArtifactManifestSha256?: string;
  previousArtifactStorageKey?: string;
  previousVerifiedAt?: string;
  updatedAt?: string;
};

type PluginTrustRefreshCheck = {
  name: string;
  status: "verified" | "changed" | "missing" | "unknown";
  local?: string | number | boolean;
  registry?: string | number | boolean;
  message?: string;
};

type PluginTrustRefreshResult = {
  ok: boolean;
  checkedAt: string;
  packageName: string;
  version: string;
  registryStatus?: string | null;
  checks: PluginTrustRefreshCheck[];
};

function buildPluginTrustProof(install: PluginInstallRecord | undefined): PluginTrustProof | null {
  if (!install || install.source !== "corehub" || !install.corehubPackage) {
    return null;
  }
  return {
    corehubPackage: install.corehubPackage,
    corehubUrl: install.corehubUrl,
    version: install.version,
    publisherHandle: install.publisherHandle,
    corehubVerificationTier: install.corehubVerificationTier,
    artifactSha256: install.artifactSha256,
    artifactSize: install.artifactSize,
    artifactManifestVerified: install.artifactManifestVerified,
    artifactManifestSha256: install.artifactManifestSha256,
    artifactStorageKey: install.artifactStorageKey,
    integrity: install.integrity,
    verifiedAt: install.verifiedAt,
    resolvedAt: install.resolvedAt,
    previousVersion: install.previousVersion,
    previousArtifactSha256: install.previousArtifactSha256,
    previousArtifactManifestSha256: install.previousArtifactManifestSha256,
    previousArtifactStorageKey: install.previousArtifactStorageKey,
    previousVerifiedAt: install.previousVerifiedAt,
    updatedAt: install.updatedAt,
  };
}

function formatTrustProofLines(install: PluginInstallRecord | undefined): string[] {
  const proof = buildPluginTrustProof(install);
  if (!proof) {
    return [];
  }
  const lines = [`CoreHub package: ${proof.corehubPackage}`];
  if (proof.version) {
    lines.push(`Version: ${proof.version}`);
  }
  if (proof.publisherHandle) {
    lines.push(`Publisher: ${proof.publisherHandle}`);
  }
  if (proof.corehubVerificationTier) {
    lines.push(`Verification tier: ${proof.corehubVerificationTier}`);
  }
  if (proof.artifactSha256) {
    lines.push(`Artifact SHA-256: ${proof.artifactSha256}`);
  }
  if (typeof proof.artifactSize === "number") {
    lines.push(`Artifact size: ${proof.artifactSize} bytes`);
  }
  if (typeof proof.artifactManifestVerified === "boolean") {
    lines.push(`Artifact manifest verified: ${proof.artifactManifestVerified ? "yes" : "no"}`);
  }
  if (proof.artifactManifestSha256) {
    lines.push(`Artifact manifest SHA-256: ${proof.artifactManifestSha256}`);
  }
  if (proof.artifactStorageKey) {
    lines.push(`Storage locator: ${proof.artifactStorageKey}`);
  }
  if (proof.integrity) {
    lines.push(`Archive integrity: ${proof.integrity}`);
  }
  if (proof.verifiedAt) {
    lines.push(`Verified at: ${proof.verifiedAt}`);
  } else if (proof.resolvedAt) {
    lines.push(`Resolved at: ${proof.resolvedAt}`);
  }
  if (proof.updatedAt) {
    lines.push(`Updated at: ${proof.updatedAt}`);
  }
  if (proof.previousVersion) {
    lines.push(`Previous version: ${proof.previousVersion}`);
  }
  if (proof.previousArtifactSha256) {
    lines.push(`Previous artifact SHA-256: ${proof.previousArtifactSha256}`);
  }
  if (proof.previousArtifactManifestSha256) {
    lines.push(`Previous artifact manifest SHA-256: ${proof.previousArtifactManifestSha256}`);
  }
  if (proof.previousArtifactStorageKey) {
    lines.push(`Previous storage locator: ${proof.previousArtifactStorageKey}`);
  }
  if (proof.previousVerifiedAt) {
    lines.push(`Previous verified at: ${proof.previousVerifiedAt}`);
  }
  return lines;
}

function buildTrustRefreshCheck(params: {
  name: string;
  local?: string | number | boolean;
  registry?: string | number | boolean;
  missingMessage?: string;
}): PluginTrustRefreshCheck {
  if (params.local === undefined && params.registry === undefined) {
    return {
      name: params.name,
      status: "unknown",
      message: params.missingMessage ?? "No local or registry value was available.",
    };
  }
  if (params.local === undefined || params.registry === undefined) {
    return {
      name: params.name,
      status: "missing",
      local: params.local,
      registry: params.registry,
      message: params.missingMessage ?? "A comparable value is missing.",
    };
  }
  return {
    name: params.name,
    status: params.local === params.registry ? "verified" : "changed",
    local: params.local,
    registry: params.registry,
  };
}

async function refreshPluginTrustProof(install: PluginInstallRecord): Promise<PluginTrustRefreshResult> {
  if (install.source !== "corehub" || !install.corehubPackage) {
    throw new Error("Only CoreHub install records can be refreshed.");
  }
  if (!install.version) {
    throw new Error("CoreHub trust refresh requires a recorded package version.");
  }

  const [detail, version] = await Promise.all([
    fetchCoreHubPackageDetail({
      name: install.corehubPackage,
      baseUrl: install.corehubUrl,
    }),
    fetchCoreHubPackageVersion({
      name: install.corehubPackage,
      version: install.version,
      baseUrl: install.corehubUrl,
    }),
  ]);
  const registryVersion = version.version;
  if (!registryVersion) {
    throw new Error(`CoreHub package version not found: ${install.corehubPackage}@${install.version}`);
  }
  const artifact = registryVersion.artifact;
  const registryManifest = artifact?.files?.find((file) => file.path === "corehub.artifact.json");
  const registryPublisher =
    registryVersion.publisher?.handle ?? detail.owner?.handle ?? detail.package?.ownerHandle ?? undefined;
  const registryStatus = registryVersion.status;
  const checks: PluginTrustRefreshCheck[] = [
    buildTrustRefreshCheck({
      name: "version",
      local: install.version,
      registry: registryVersion.version,
    }),
    buildTrustRefreshCheck({
      name: "publisherHandle",
      local: install.publisherHandle,
      registry: registryPublisher ?? undefined,
    }),
    buildTrustRefreshCheck({
      name: "corehubVerificationTier",
      local: install.corehubVerificationTier,
      registry: detail.package?.verification?.tier,
    }),
    buildTrustRefreshCheck({
      name: "artifactSha256",
      local: install.artifactSha256,
      registry: artifact?.sha256,
    }),
    buildTrustRefreshCheck({
      name: "artifactSize",
      local: install.artifactSize,
      registry: artifact?.size,
    }),
    buildTrustRefreshCheck({
      name: "artifactManifestSha256",
      local: install.artifactManifestSha256,
      registry: registryManifest?.sha256,
      missingMessage: "Registry metadata does not declare corehub.artifact.json.",
    }),
    buildTrustRefreshCheck({
      name: "artifactStorageKey",
      local: install.artifactStorageKey,
      registry: artifact?.storage?.key,
    }),
  ];
  if (install.artifactManifestVerified === true) {
    checks.push(
      buildTrustRefreshCheck({
        name: "artifactManifestDeclared",
        local: true,
        registry: Boolean(registryManifest),
        missingMessage: "Installed proof expected an internal manifest, but registry metadata omitted it.",
      }),
    );
  }
  if (registryStatus === "blocked" || registryStatus === "deprecated") {
    checks.push({
      name: "registryStatus",
      status: "changed",
      local: "installed",
      registry: registryStatus,
      message: `Registry marks this version as ${registryStatus}.`,
    });
  } else if (registryStatus) {
    checks.push({
      name: "registryStatus",
      status: "verified",
      registry: registryStatus,
    });
  }
  return {
    ok: checks.every((check) => check.status === "verified" || check.status === "unknown"),
    checkedAt: new Date().toISOString(),
    packageName: install.corehubPackage,
    version: install.version,
    registryStatus,
    checks,
  };
}

function formatTrustRefreshLines(refresh: PluginTrustRefreshResult): string[] {
  const lines = [
    `Refresh: ${refresh.ok ? theme.success("verified") : theme.error("failed")}`,
    `Checked at: ${refresh.checkedAt}`,
  ];
  if (refresh.registryStatus) {
    lines.push(`Registry status: ${refresh.registryStatus}`);
  }
  for (const check of refresh.checks) {
    const marker =
      check.status === "verified"
        ? theme.success("verified")
        : check.status === "changed"
          ? theme.error("changed")
          : check.status === "missing"
            ? theme.warn("missing")
            : theme.muted("unknown");
    const values =
      check.local !== undefined || check.registry !== undefined
        ? ` local=${String(check.local ?? "-")} registry=${String(check.registry ?? "-")}`
        : "";
    lines.push(`${check.name}: ${marker}${values}`);
    if (check.message) {
      lines.push(`  ${check.message}`);
    }
  }
  return lines;
}

function normalizePolicyList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function formatPolicyBoolean(value: boolean | undefined): string {
  if (value === false) {
    return "no";
  }
  if (value === true) {
    return "yes";
  }
  return "yes (default)";
}

function formatPolicyList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "any";
}

type CoreHubPolicyEvaluationStatus = "allowed" | "blocked" | "review";

type CoreHubPolicyEvaluation = {
  pluginId: string;
  packageName: string;
  version?: string;
  channel?: string;
  publisherHandle?: string;
  verificationTier?: string;
  registryStatus?: string | null;
  status: CoreHubPolicyEvaluationStatus;
  notes: string[];
};

function evaluateCoreHubInstallPolicy(params: {
  pluginId: string;
  install: PluginInstallRecord;
  policy?: PluginCoreHubPolicyConfig;
}): CoreHubPolicyEvaluation {
  const policy = params.policy;
  const install = params.install;
  const notes: string[] = [];
  const allowedPublishers = normalizePolicyList(policy?.allowedPublishers);
  const requiredVerificationTiers = normalizePolicyList(policy?.requiredVerificationTiers);

  if (policy?.allowCommunity === false && install.corehubChannel !== "official") {
    notes.push(`requires official channel; found ${install.corehubChannel ?? "unknown"}`);
  }
  if (allowedPublishers.length > 0 && !allowedPublishers.includes(install.publisherHandle ?? "")) {
    notes.push(`publisher ${install.publisherHandle ?? "unknown"} is not allowed`);
  }
  if (
    requiredVerificationTiers.length > 0 &&
    !requiredVerificationTiers.includes(install.corehubVerificationTier ?? "")
  ) {
    notes.push(`verification tier ${install.corehubVerificationTier ?? "unknown"} is not allowed`);
  }
  return {
    pluginId: params.pluginId,
    packageName: install.corehubPackage ?? params.pluginId,
    version: install.version,
    channel: install.corehubChannel,
    publisherHandle: install.publisherHandle,
    verificationTier: install.corehubVerificationTier,
    status: notes.length > 0 ? "blocked" : "allowed",
    notes,
  };
}

async function buildCoreHubPolicyCandidateReport(params: {
  spec: string;
  config: CoreBlowConfig;
}): Promise<CoreHubPolicyEvaluation & { configured: boolean; policy: PluginCoreHubPolicyConfig }> {
  const parsed = parseCoreHubPluginSpec(params.spec);
  if (!parsed?.name) {
    throw new Error(`Invalid CoreHub package spec: ${params.spec}`);
  }
  const policy = params.config.plugins?.corehub ?? {};
  const detail = await fetchCoreHubPackageDetail({ name: parsed.name });
  const pkg = detail.package;
  if (!pkg) {
    throw new Error(`CoreHub package not found: ${parsed.name}`);
  }
  const version = parsed.version ?? pkg.latestVersion ?? pkg.tags?.latest ?? null;
  if (!version) {
    throw new Error(`CoreHub package has no installable version: ${parsed.name}`);
  }
  const versionDetail = await fetchCoreHubPackageVersion({
    name: parsed.name,
    version,
  });
  const registryVersion = versionDetail.version;
  if (!registryVersion) {
    throw new Error(`CoreHub package version not found: ${parsed.name}@${version}`);
  }
  const corehubFamily =
    pkg.family === "code-plugin" || pkg.family === "bundle-plugin" ? pkg.family : null;
  if (!corehubFamily) {
    throw new Error(`CoreHub package is not an installable plugin: ${parsed.name}`);
  }

  const publisherHandle =
    registryVersion.publisher?.handle ?? detail.owner?.handle ?? pkg.ownerHandle ?? undefined;
  const verificationTier = registryVersion.verification?.tier ?? pkg.verification?.tier;
  const install: PluginInstallRecord = {
    source: "corehub",
    corehubPackage: parsed.name,
    corehubFamily,
    corehubChannel: pkg.channel,
    corehubVerificationTier: verificationTier,
    publisherHandle: publisherHandle ?? undefined,
    version: registryVersion.version,
  };
  const evaluation = evaluateCoreHubInstallPolicy({
    pluginId: parsed.name,
    install,
    policy,
  });
  const notes = [...evaluation.notes];
  if (registryVersion.status === "blocked") {
    notes.push("registry marks this version as blocked");
  } else if (registryVersion.status === "deprecated" && policy.allowDeprecated === false) {
    notes.push("deprecated versions are blocked by policy");
  } else if (registryVersion.status === "deprecated") {
    notes.push("registry marks this version as deprecated");
  }

  return {
    ...evaluation,
    registryStatus: registryVersion.status,
    status:
      registryVersion.status === "blocked" ||
      (registryVersion.status === "deprecated" && policy.allowDeprecated === false) ||
      evaluation.status === "blocked"
        ? "blocked"
        : notes.length > 0
          ? "review"
          : "allowed",
    notes,
    configured: Boolean(params.config.plugins?.corehub),
    policy,
  };
}

function buildCoreHubPolicyReport(config: CoreBlowConfig): {
  policy: PluginCoreHubPolicyConfig;
  configured: boolean;
  installed: CoreHubPolicyEvaluation[];
} {
  const policy = config.plugins?.corehub ?? {};
  const installed = Object.entries(config.plugins?.installs ?? {})
    .filter((entry): entry is [string, PluginInstallRecord] => entry[1].source === "corehub")
    .map(([pluginId, install]) =>
      evaluateCoreHubInstallPolicy({
        pluginId,
        install,
        policy,
      }),
    );
  return {
    policy,
    configured: Boolean(config.plugins?.corehub),
    installed,
  };
}

function summarizeCoreHubPolicyReport(report: ReturnType<typeof buildCoreHubPolicyReport>): {
  ok: boolean;
  total: number;
  allowed: number;
  blocked: number;
  review: number;
} {
  const blocked = report.installed.filter((entry) => entry.status === "blocked").length;
  const review = report.installed.filter((entry) => entry.status === "review").length;
  const allowed = report.installed.filter((entry) => entry.status === "allowed").length;
  return {
    ok: blocked === 0,
    total: report.installed.length,
    allowed,
    blocked,
    review,
  };
}

type CoreHubPolicyAuditRefreshEntry = {
  pluginId: string;
  ok: boolean;
  refresh?: PluginTrustRefreshResult;
  error?: string;
};

async function refreshCoreHubPolicyAudit(report: ReturnType<typeof buildCoreHubPolicyReport>, config: CoreBlowConfig): Promise<{
  ok: boolean;
  refreshed: CoreHubPolicyAuditRefreshEntry[];
}> {
  const installed = config.plugins?.installs ?? {};
  const refreshed: CoreHubPolicyAuditRefreshEntry[] = [];
  for (const entry of report.installed) {
    const install = installed[entry.pluginId];
    if (!install || install.source !== "corehub") {
      continue;
    }
    try {
      const refresh = await refreshPluginTrustProof(install);
      refreshed.push({
        pluginId: entry.pluginId,
        ok: refresh.ok,
        refresh,
      });
    } catch (error) {
      refreshed.push({
        pluginId: entry.pluginId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    ok: refreshed.every((entry) => entry.ok),
    refreshed,
  };
}

export function registerPluginsCli(program: Command) {
  const plugins = program
    .command("plugins")
    .description("Manage CoreBlow plugins and extensions")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/plugins", "docs.coreblow.com/cli/plugins")}\n`,
    );

  plugins
    .command("list")
    .description("List discovered plugins")
    .option("--json", "Print JSON")
    .option("--enabled", "Only show enabled plugins", false)
    .option("--verbose", "Show detailed entries", false)
    .action((opts: PluginsListOptions) => {
      const report = buildPluginStatusReport();
      const list = opts.enabled
        ? report.plugins.filter((p) => p.status === "loaded")
        : report.plugins;

      if (opts.json) {
        const payload = {
          workspaceDir: report.workspaceDir,
          plugins: list,
          diagnostics: report.diagnostics,
        };
        defaultRuntime.writeJson(payload);
        return;
      }

      if (list.length === 0) {
        defaultRuntime.log(theme.muted("No plugins found."));
        return;
      }

      const loaded = list.filter((p) => p.status === "loaded").length;
      defaultRuntime.log(
        `${theme.heading("Plugins")} ${theme.muted(`(${loaded}/${list.length} loaded)`)}`,
      );

      if (!opts.verbose) {
        const tableWidth = getTerminalTableWidth();
        const sourceRoots = resolvePluginSourceRoots({
          workspaceDir: report.workspaceDir,
        });
        const usedRoots = new Set<keyof typeof sourceRoots>();
        const rows = list.map((plugin) => {
          const desc = plugin.description ? theme.muted(plugin.description) : "";
          const formattedSource = formatPluginSourceForTable(plugin, sourceRoots);
          if (formattedSource.rootKey) {
            usedRoots.add(formattedSource.rootKey);
          }
          const sourceLine = desc ? `${formattedSource.value}\n${desc}` : formattedSource.value;
          return {
            Name: plugin.name || plugin.id,
            ID: plugin.name && plugin.name !== plugin.id ? plugin.id : "",
            Format: plugin.format ?? "coreblow",
            Status:
              plugin.status === "loaded"
                ? theme.success("loaded")
                : plugin.status === "disabled"
                  ? theme.warn("disabled")
                  : theme.error("error"),
            Source: sourceLine,
            Version: plugin.version ?? "",
          };
        });

        if (usedRoots.size > 0) {
          defaultRuntime.log(theme.muted("Source roots:"));
          for (const key of ["stock", "workspace", "global"] as const) {
            if (!usedRoots.has(key)) {
              continue;
            }
            const dir = sourceRoots[key];
            if (!dir) {
              continue;
            }
            defaultRuntime.log(`  ${theme.command(`${key}:`)} ${theme.muted(dir)}`);
          }
          defaultRuntime.log("");
        }

        defaultRuntime.log(
          renderTable({
            width: tableWidth,
            columns: [
              { key: "Name", header: "Name", minWidth: 14, flex: true },
              { key: "ID", header: "ID", minWidth: 10, flex: true },
              { key: "Format", header: "Format", minWidth: 9 },
              { key: "Status", header: "Status", minWidth: 10 },
              { key: "Source", header: "Source", minWidth: 26, flex: true },
              { key: "Version", header: "Version", minWidth: 8 },
            ],
            rows,
          }).trimEnd(),
        );
        return;
      }

      const lines: string[] = [];
      for (const plugin of list) {
        lines.push(formatPluginLine(plugin, true));
        lines.push("");
      }
      defaultRuntime.log(lines.join("\n").trim());
    });

  plugins
    .command("inspect")
    .alias("info")
    .description("Inspect plugin details")
    .argument("[id]", "Plugin id")
    .option("--all", "Inspect all plugins")
    .option("--json", "Print JSON")
    .action((id: string | undefined, opts: PluginInspectOptions) => {
      const cfg = loadConfig();
      const report = buildPluginStatusReport({ config: cfg });
      if (opts.all) {
        if (id) {
          defaultRuntime.error("Pass either a plugin id or --all, not both.");
          return defaultRuntime.exit(1);
        }
        const inspectAll = buildAllPluginInspectReports({
          config: cfg,
          report,
        });
        const inspectAllWithInstall = inspectAll.map((inspect) => ({
          ...inspect,
          install: cfg.plugins?.installs?.[inspect.plugin.id],
        }));

        if (opts.json) {
          defaultRuntime.writeJson(inspectAllWithInstall);
          return;
        }

        const tableWidth = getTerminalTableWidth();
        const rows = inspectAll.map((inspect) => ({
          Name: inspect.plugin.name || inspect.plugin.id,
          ID:
            inspect.plugin.name && inspect.plugin.name !== inspect.plugin.id
              ? inspect.plugin.id
              : "",
          Status:
            inspect.plugin.status === "loaded"
              ? theme.success("loaded")
              : inspect.plugin.status === "disabled"
                ? theme.warn("disabled")
                : theme.error("error"),
          Shape: inspect.shape,
          Capabilities: formatCapabilityKinds(inspect.capabilities),
          Compatibility:
            inspect.compatibility.length > 0
              ? inspect.compatibility
                  .map((entry) => (entry.severity === "warn" ? `warn:${entry.code}` : entry.code))
                  .join(", ")
              : "none",
          Bundle:
            inspect.bundleCapabilities.length > 0 ? inspect.bundleCapabilities.join(", ") : "-",
          Hooks: formatHookSummary({
            usesLegacyBeforeAgentStart: inspect.usesLegacyBeforeAgentStart,
            typedHookCount: inspect.typedHooks.length,
            customHookCount: inspect.customHooks.length,
          }),
        }));
        defaultRuntime.log(
          renderTable({
            width: tableWidth,
            columns: [
              { key: "Name", header: "Name", minWidth: 14, flex: true },
              { key: "ID", header: "ID", minWidth: 10, flex: true },
              { key: "Status", header: "Status", minWidth: 10 },
              { key: "Shape", header: "Shape", minWidth: 18 },
              { key: "Capabilities", header: "Capabilities", minWidth: 28, flex: true },
              { key: "Compatibility", header: "Compatibility", minWidth: 24, flex: true },
              { key: "Bundle", header: "Bundle", minWidth: 14, flex: true },
              { key: "Hooks", header: "Hooks", minWidth: 20, flex: true },
            ],
            rows,
          }).trimEnd(),
        );
        return;
      }

      if (!id) {
        defaultRuntime.error("Provide a plugin id or use --all.");
        return defaultRuntime.exit(1);
      }

      const resolved = resolvePluginConfigId({
        rawId: id,
        config: cfg,
        plugins: report.plugins,
      });
      const inspect = buildPluginInspectReport({
        id: resolved.pluginId,
        config: cfg,
        report,
      });
      if (!inspect) {
        defaultRuntime.error(`Plugin not found: ${id}`);
        return defaultRuntime.exit(1);
      }
      const install = cfg.plugins?.installs?.[inspect.plugin.id];

      if (opts.json) {
        defaultRuntime.writeJson({
          ...inspect,
          install,
        });
        return;
      }

      const lines: string[] = [];
      lines.push(theme.heading(inspect.plugin.name || inspect.plugin.id));
      if (inspect.plugin.name && inspect.plugin.name !== inspect.plugin.id) {
        lines.push(theme.muted(`id: ${inspect.plugin.id}`));
      }
      if (inspect.plugin.description) {
        lines.push(inspect.plugin.description);
      }
      lines.push("");
      lines.push(`${theme.muted("Status:")} ${inspect.plugin.status}`);
      lines.push(`${theme.muted("Format:")} ${inspect.plugin.format ?? "coreblow"}`);
      if (inspect.plugin.bundleFormat) {
        lines.push(`${theme.muted("Bundle format:")} ${inspect.plugin.bundleFormat}`);
      }
      lines.push(`${theme.muted("Source:")} ${shortenHomeInString(inspect.plugin.source)}`);
      lines.push(`${theme.muted("Origin:")} ${inspect.plugin.origin}`);
      if (inspect.plugin.version) {
        lines.push(`${theme.muted("Version:")} ${inspect.plugin.version}`);
      }
      lines.push(`${theme.muted("Shape:")} ${inspect.shape}`);
      lines.push(`${theme.muted("Capability mode:")} ${inspect.capabilityMode}`);
      lines.push(
        `${theme.muted("Legacy before_agent_start:")} ${inspect.usesLegacyBeforeAgentStart ? "yes" : "no"}`,
      );
      if (inspect.bundleCapabilities.length > 0) {
        lines.push(
          `${theme.muted("Bundle capabilities:")} ${inspect.bundleCapabilities.join(", ")}`,
        );
      }
      lines.push(
        ...formatInspectSection(
          "Capabilities",
          inspect.capabilities.map(
            (entry) =>
              `${entry.kind}: ${entry.ids.length > 0 ? entry.ids.join(", ") : "(registered)"}`,
          ),
        ),
      );
      lines.push(
        ...formatInspectSection(
          "Typed hooks",
          inspect.typedHooks.map((entry) =>
            entry.priority == null ? entry.name : `${entry.name} (priority ${entry.priority})`,
          ),
        ),
      );
      lines.push(
        ...formatInspectSection(
          "Compatibility warnings",
          inspect.compatibility.map(formatPluginCompatibilityNotice),
        ),
      );
      lines.push(
        ...formatInspectSection(
          "Custom hooks",
          inspect.customHooks.map((entry) => `${entry.name}: ${entry.events.join(", ")}`),
        ),
      );
      lines.push(
        ...formatInspectSection(
          "Tools",
          inspect.tools.map((entry) => {
            const names = entry.names.length > 0 ? entry.names.join(", ") : "(anonymous)";
            return entry.optional ? `${names} [optional]` : names;
          }),
        ),
      );
      lines.push(...formatInspectSection("Commands", inspect.commands));
      lines.push(...formatInspectSection("CLI commands", inspect.cliCommands));
      lines.push(...formatInspectSection("Services", inspect.services));
      lines.push(...formatInspectSection("Gateway methods", inspect.gatewayMethods));
      lines.push(
        ...formatInspectSection(
          "MCP servers",
          inspect.mcpServers.map((entry) =>
            entry.hasStdioTransport ? entry.name : `${entry.name} (unsupported transport)`,
          ),
        ),
      );
      lines.push(
        ...formatInspectSection(
          "LSP servers",
          inspect.lspServers.map((entry) =>
            entry.hasStdioTransport ? entry.name : `${entry.name} (unsupported transport)`,
          ),
        ),
      );
      if (inspect.httpRouteCount > 0) {
        lines.push(...formatInspectSection("HTTP routes", [String(inspect.httpRouteCount)]));
      }
      const policyLines: string[] = [];
      if (typeof inspect.policy.allowPromptInjection === "boolean") {
        policyLines.push(`allowPromptInjection: ${inspect.policy.allowPromptInjection}`);
      }
      if (typeof inspect.policy.allowModelOverride === "boolean") {
        policyLines.push(`allowModelOverride: ${inspect.policy.allowModelOverride}`);
      }
      if (inspect.policy.hasAllowedModelsConfig) {
        policyLines.push(
          `allowedModels: ${
            inspect.policy.allowedModels.length > 0
              ? inspect.policy.allowedModels.join(", ")
              : "(configured but empty)"
          }`,
        );
      }
      lines.push(...formatInspectSection("Policy", policyLines));
      lines.push(
        ...formatInspectSection(
          "Diagnostics",
          inspect.diagnostics.map((entry) => `${entry.level.toUpperCase()}: ${entry.message}`),
        ),
      );
      lines.push(...formatInspectSection("Install", formatInstallLines(install)));
      lines.push(...formatInspectSection("Trust proof", formatTrustProofLines(install)));
      if (inspect.plugin.error) {
        lines.push("", `${theme.error("Error:")} ${inspect.plugin.error}`);
      }
      defaultRuntime.log(lines.join("\n"));
    });

  plugins
    .command("verify")
    .description("Show recorded CoreHub trust proof for an installed plugin")
    .argument("<id>", "Plugin id or CoreHub package")
    .option("--json", "Print JSON")
    .option("--refresh", "Compare recorded trust proof against CoreHub Registry metadata", false)
    .action(async (id: string, opts: PluginVerifyOptions) => {
      const cfg = loadConfig();
      const { pluginId } = resolvePluginConfigId({
        rawId: id,
        config: cfg,
        plugins: [],
      });
      const install = cfg.plugins?.installs?.[pluginId];
      const proof = buildPluginTrustProof(install);

      let refresh: PluginTrustRefreshResult | undefined;
      if (opts.refresh && install) {
        try {
          refresh = await refreshPluginTrustProof(install);
        } catch (error) {
          if (opts.json) {
            defaultRuntime.writeJson({
              pluginId,
              ok: false,
              proof,
              refresh: {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              },
            });
            return;
          }
          defaultRuntime.error(error instanceof Error ? error.message : String(error));
          return defaultRuntime.exit(1);
        }
      }

      if (opts.json) {
        defaultRuntime.writeJson({
          pluginId,
          ok: Boolean(proof) && (!opts.refresh || refresh?.ok === true),
          proof,
          ...(opts.refresh ? { refresh } : {}),
        });
        return;
      }

      if (!proof) {
        if (!install) {
          defaultRuntime.error(`Plugin install record not found: ${id}`);
        } else {
          defaultRuntime.error(`No CoreHub trust proof recorded for plugin: ${pluginId}`);
        }
        return defaultRuntime.exit(1);
      }

      const lines = [
        theme.heading(`Trust proof: ${pluginId}`),
        ...formatTrustProofLines(install),
        ...(refresh ? ["", ...formatTrustRefreshLines(refresh)] : []),
      ];
      defaultRuntime.log(lines.join("\n"));
      if (refresh && !refresh.ok) {
        return defaultRuntime.exit(1);
      }
    });

  const policy = plugins
    .command("policy")
    .description("Show active CoreHub plugin install policy")
    .option("--json", "Print JSON")
    .action((opts: PluginPolicyOptions) => {
      const cfg = loadConfig();
      const report = buildCoreHubPolicyReport(cfg);
      if (opts.json) {
        defaultRuntime.writeJson(report);
        return;
      }

      const allowedPublishers = normalizePolicyList(report.policy.allowedPublishers);
      const requiredVerificationTiers = normalizePolicyList(report.policy.requiredVerificationTiers);
      const lines = [
        theme.heading("CoreHub plugin policy"),
        `${theme.muted("Configured:")} ${report.configured ? "yes" : "no"}`,
        `${theme.muted("Allow community packages:")} ${formatPolicyBoolean(report.policy.allowCommunity)}`,
        `${theme.muted("Allow deprecated versions:")} ${formatPolicyBoolean(report.policy.allowDeprecated)}`,
        `${theme.muted("Allowed publishers:")} ${formatPolicyList(allowedPublishers)}`,
        `${theme.muted("Required verification tiers:")} ${formatPolicyList(requiredVerificationTiers)}`,
      ];
      if (report.installed.length === 0) {
        lines.push("", theme.muted("No CoreHub-installed plugins recorded."));
        defaultRuntime.log(lines.join("\n"));
        return;
      }

      const rows = report.installed.map((entry) => ({
        Plugin: entry.pluginId,
        Package: entry.packageName,
        Version: entry.version ?? "-",
        Channel: entry.channel ?? "-",
        Publisher: entry.publisherHandle ?? "-",
        Verification: entry.verificationTier ?? "-",
        Status:
          entry.status === "allowed"
            ? theme.success("allowed")
            : entry.status === "blocked"
              ? theme.error("blocked")
              : theme.warn("review"),
        Notes: entry.notes.length > 0 ? entry.notes.join("; ") : "-",
      }));
      lines.push(
        "",
        theme.muted("Installed CoreHub plugins:"),
        renderTable({
          width: getTerminalTableWidth(),
          columns: [
            { key: "Plugin", header: "Plugin", minWidth: 12, flex: true },
            { key: "Package", header: "Package", minWidth: 12, flex: true },
            { key: "Version", header: "Version", minWidth: 8 },
            { key: "Channel", header: "Channel", minWidth: 10 },
            { key: "Publisher", header: "Publisher", minWidth: 10 },
            { key: "Verification", header: "Verification", minWidth: 14 },
            { key: "Status", header: "Status", minWidth: 9 },
            { key: "Notes", header: "Notes", minWidth: 24, flex: true },
          ],
          rows,
        }).trimEnd(),
      );
      defaultRuntime.log(lines.join("\n"));
    });

  policy
    .command("audit")
    .description("Audit installed CoreHub plugins against the active install policy")
    .option("--json", "Print JSON")
    .option("--refresh", "Refresh recorded trust proofs against CoreHub Registry metadata", false)
    .action(async (opts: PluginPolicyAuditOptions) => {
      const cfg = loadConfig();
      const report = buildCoreHubPolicyReport(cfg);
      const summary = summarizeCoreHubPolicyReport(report);
      const jsonOutput = Boolean(opts.json || policy.opts<PluginPolicyOptions>().json);
      const refresh = opts.refresh ? await refreshCoreHubPolicyAudit(report, cfg) : undefined;
      const ok = summary.ok && (refresh?.ok ?? true);
      if (jsonOutput) {
        defaultRuntime.writeJson({
          ...summary,
          ok,
          policy: report.policy,
          configured: report.configured,
          installed: report.installed,
          ...(refresh ? { refresh } : {}),
        });
        if (!ok) {
          return defaultRuntime.exit(1);
        }
        return;
      }

      const result = ok ? theme.success("passed") : theme.error("failed");
      const lines = [
        theme.heading("CoreHub policy audit"),
        `${theme.muted("Result:")} ${result}`,
        `${theme.muted("Installed CoreHub plugins:")} ${summary.total}`,
        `${theme.muted("Allowed:")} ${summary.allowed}`,
        `${theme.muted("Blocked:")} ${summary.blocked}`,
      ];
      if (summary.review > 0) {
        lines.push(`${theme.muted("Review:")} ${summary.review}`);
      }
      const flagged = report.installed.filter((entry) => entry.status !== "allowed");
      if (flagged.length > 0) {
        lines.push("");
        for (const entry of flagged) {
          lines.push(
            `${entry.status.toUpperCase()}: ${entry.pluginId} (${entry.packageName}@${entry.version ?? "unknown"})`,
          );
          for (const note of entry.notes) {
            lines.push(`  - ${note}`);
          }
        }
      }
      if (refresh) {
        lines.push("");
        lines.push(theme.muted("Registry refresh:"));
        for (const entry of refresh.refreshed) {
          const marker = entry.ok ? theme.success("verified") : theme.error("failed");
          const registryStatus = entry.refresh?.registryStatus
            ? ` status=${entry.refresh.registryStatus}`
            : "";
          lines.push(`${entry.pluginId}: ${marker}${registryStatus}`);
          if (entry.error) {
            lines.push(`  ${entry.error}`);
          }
          for (const check of entry.refresh?.checks ?? []) {
            if (check.status === "verified" || check.status === "unknown") {
              continue;
            }
            lines.push(`  ${check.name}: ${check.status}`);
            if (check.message) {
              lines.push(`    ${check.message}`);
            }
          }
        }
      }
      defaultRuntime.log(lines.join("\n"));
      if (!ok) {
        return defaultRuntime.exit(1);
      }
    });

  policy
    .command("check")
    .description("Check a CoreHub package against the active plugin install policy")
    .argument("<spec>", "CoreHub package spec")
    .option("--json", "Print JSON")
    .action(async (spec: string, opts: PluginPolicyCheckOptions) => {
      const cfg = loadConfig();
      const jsonOutput = Boolean(opts.json || policy.opts<PluginPolicyOptions>().json);
      let report: Awaited<ReturnType<typeof buildCoreHubPolicyCandidateReport>>;
      try {
        report = await buildCoreHubPolicyCandidateReport({ spec, config: cfg });
      } catch (error) {
        if (jsonOutput) {
          defaultRuntime.writeJson({
            ok: false,
            spec,
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        defaultRuntime.error(error instanceof Error ? error.message : String(error));
        return defaultRuntime.exit(1);
      }

      if (jsonOutput) {
        defaultRuntime.writeJson({
          ok: report.status === "allowed",
          ...report,
        });
        if (report.status === "blocked") {
          return defaultRuntime.exit(1);
        }
        return;
      }

      const status =
        report.status === "allowed"
          ? theme.success("allowed")
          : report.status === "blocked"
            ? theme.error("blocked")
            : theme.warn("review");
      const lines = [
        theme.heading(`CoreHub policy check: ${report.packageName}`),
        `${theme.muted("Configured:")} ${report.configured ? "yes" : "no"}`,
        `${theme.muted("Version:")} ${report.version ?? "-"}`,
        `${theme.muted("Channel:")} ${report.channel ?? "-"}`,
        `${theme.muted("Publisher:")} ${report.publisherHandle ?? "-"}`,
        `${theme.muted("Verification tier:")} ${report.verificationTier ?? "-"}`,
        `${theme.muted("Registry status:")} ${report.registryStatus ?? "available"}`,
        `${theme.muted("Policy result:")} ${status}`,
      ];
      if (report.notes.length > 0) {
        lines.push("", theme.muted("Notes:"), ...report.notes.map((note) => `- ${note}`));
      }
      defaultRuntime.log(lines.join("\n"));
      if (report.status === "blocked") {
        return defaultRuntime.exit(1);
      }
    });

  plugins
    .command("enable")
    .description("Enable a plugin in config")
    .argument("<id>", "Plugin id")
    .action(async (id: string) => {
      const cfg = loadConfig();
      const enableResult = enablePluginInConfig(cfg, id);
      let next: CoreBlowConfig = enableResult.config;
      const slotResult = applySlotSelectionForPlugin(next, id);
      next = slotResult.config;
      await writeConfigFile(next);
      logSlotWarnings(slotResult.warnings);
      if (enableResult.enabled) {
        defaultRuntime.log(t("extensions.enabled", { name: id }));
        return;
      }
      defaultRuntime.log(
        theme.warn(
          `Plugin "${id}" could not be enabled (${enableResult.reason ?? "unknown reason"}).`,
        ),
      );
    });

  plugins
    .command("disable")
    .description("Disable a plugin in config")
    .argument("<id>", "Plugin id")
    .action(async (id: string) => {
      const cfg = loadConfig();
      const next = setPluginEnabledInConfig(cfg, id, false);
      await writeConfigFile(next);
      defaultRuntime.log(t("extensions.disabled", { name: id }));
    });

  plugins
    .command("uninstall")
    .description("Uninstall a plugin")
    .argument("<id>", "Plugin id")
    .option("--keep-files", "Keep installed files on disk", false)
    .option("--keep-config", "Deprecated alias for --keep-files", false)
    .option("--force", "Skip confirmation prompt", false)
    .option("--dry-run", "Show what would be removed without making changes", false)
    .action(async (id: string, opts: PluginUninstallOptions) => {
      const cfg = loadConfig();
      const report = buildPluginStatusReport({ config: cfg });
      const extensionsDir = path.join(resolveStateDir(process.env, os.homedir), "extensions");
      const keepFiles = Boolean(opts.keepFiles || opts.keepConfig);

      if (opts.keepConfig) {
        defaultRuntime.log(theme.warn("`--keep-config` is deprecated, use `--keep-files`."));
      }

      const { plugin, pluginId } = resolvePluginConfigId({
        rawId: id,
        config: cfg,
        plugins: report.plugins,
      });
      const hasEntry = pluginId in (cfg.plugins?.entries ?? {});
      const hasInstall = pluginId in (cfg.plugins?.installs ?? {});

      if (!hasEntry && !hasInstall) {
        if (plugin) {
          defaultRuntime.error(
            `Plugin "${pluginId}" is not managed by plugins config/install records and cannot be uninstalled.`,
          );
        } else {
          defaultRuntime.error(t("extensions.not_found", { name: id }));
        }
        return defaultRuntime.exit(1);
      }

      const install = cfg.plugins?.installs?.[pluginId];
      const isLinked = install?.source === "path";
      const preview: string[] = [];
      if (hasEntry) {
        preview.push("config entry");
      }
      if (hasInstall) {
        preview.push("install record");
      }
      if (cfg.plugins?.allow?.includes(pluginId)) {
        preview.push("allowlist entry");
      }
      if (
        isLinked &&
        install?.sourcePath &&
        cfg.plugins?.load?.paths?.includes(install.sourcePath)
      ) {
        preview.push("load path");
      }
      if (cfg.plugins?.slots?.memory === pluginId) {
        preview.push(`memory slot (will reset to "memory-core")`);
      }
      const channelIds = plugin?.status === "loaded" ? plugin.channelIds : undefined;
      const channels = cfg.channels as Record<string, unknown> | undefined;
      if (hasInstall && channels) {
        for (const key of resolveUninstallChannelConfigKeys(pluginId, { channelIds })) {
          if (Object.hasOwn(channels, key)) {
            preview.push(`channel config (channels.${key})`);
          }
        }
      }
      const deleteTarget = !keepFiles
        ? resolveUninstallDirectoryTarget({
            pluginId,
            hasInstall,
            installRecord: install,
            extensionsDir,
          })
        : null;
      if (deleteTarget) {
        preview.push(`directory: ${shortenHomePath(deleteTarget)}`);
      }

      const pluginName = plugin?.name || pluginId;
      defaultRuntime.log(
        `Plugin: ${theme.command(pluginName)}${pluginName !== pluginId ? theme.muted(` (${pluginId})`) : ""}`,
      );
      defaultRuntime.log(`Will remove: ${preview.length > 0 ? preview.join(", ") : "(nothing)"}`);

      if (opts.dryRun) {
        defaultRuntime.log(theme.muted("Dry run, no changes made."));
        return;
      }

      if (!opts.force) {
        const confirmed = await promptYesNo(`Uninstall plugin "${pluginId}"?`);
        if (!confirmed) {
          defaultRuntime.log("Cancelled.");
          return;
        }
      }

      const result = await uninstallPlugin({
        config: cfg,
        pluginId,
        channelIds,
        deleteFiles: !keepFiles,
        extensionsDir,
      });

      if (!result.ok) {
        defaultRuntime.error(result.error);
        return defaultRuntime.exit(1);
      }
      for (const warning of result.warnings) {
        defaultRuntime.log(theme.warn(warning));
      }

      await writeConfigFile(result.config);

      const removed: string[] = [];
      if (result.actions.entry) {
        removed.push("config entry");
      }
      if (result.actions.install) {
        removed.push("install record");
      }
      if (result.actions.allowlist) {
        removed.push("allowlist");
      }
      if (result.actions.loadPath) {
        removed.push("load path");
      }
      if (result.actions.memorySlot) {
        removed.push("memory slot");
      }
      if (result.actions.channelConfig) {
        removed.push("channel config");
      }
      if (result.actions.directory) {
        removed.push("directory");
      }

      defaultRuntime.log(
        t("extensions.uninstalled", {
          name: pluginId,
          removed: removed.length > 0 ? removed.join(", ") : "nothing",
        }),
      );
      defaultRuntime.log(t("extensions.restart_gateway"));
    });

  plugins
    .command("install")
    .description(
      "Install a plugin or hook pack (path, archive, npm spec, corehub:package, or marketplace entry)",
    )
    .argument(
      "<path-or-spec-or-plugin>",
      "Path (.ts/.js/.zip/.tgz/.tar.gz), npm package spec, or marketplace plugin name",
    )
    .option("-l, --link", "Link a local path instead of copying", false)
    .option("--pin", "Record npm installs as exact resolved <name>@<version>", false)
    .option("--dry-run", "Show what would be installed without writing", false)
    .option(
      "--marketplace <source>",
      "Install a Claude marketplace plugin from a local repo/path or git/GitHub source",
    )
    .action(
      async (
        raw: string,
        opts: { link?: boolean; pin?: boolean; marketplace?: string; dryRun?: boolean },
      ) => {
        await runPluginInstallCommand({ raw, opts });
      },
    );

  plugins
    .command("update")
    .description("Update installed plugins and tracked hook packs")
    .argument("[id]", "Plugin or hook-pack id (omit with --all)")
    .option("--all", "Update all tracked plugins and hook packs", false)
    .option("--dry-run", "Show what would change without writing", false)
    .action(async (id: string | undefined, opts: PluginUpdateOptions) => {
      await runPluginUpdateCommand({ id, opts });
    });

  plugins
    .command("doctor")
    .description("Report plugin load issues")
    .action(() => {
      const report = buildPluginStatusReport();
      const errors = report.plugins.filter((p) => p.status === "error");
      const diags = report.diagnostics.filter((d) => d.level === "error");
      const compatibility = buildPluginCompatibilityNotices({ report });

      if (errors.length === 0 && diags.length === 0 && compatibility.length === 0) {
        defaultRuntime.log("No plugin issues detected.");
        return;
      }

      const lines: string[] = [];
      if (errors.length > 0) {
        lines.push(theme.error("Plugin errors:"));
        for (const entry of errors) {
          lines.push(`- ${entry.id}: ${entry.error ?? "failed to load"} (${entry.source})`);
        }
      }
      if (diags.length > 0) {
        if (lines.length > 0) {
          lines.push("");
        }
        lines.push(theme.warn("Diagnostics:"));
        for (const diag of diags) {
          const target = diag.pluginId ? `${diag.pluginId}: ` : "";
          lines.push(`- ${target}${diag.message}`);
        }
      }
      if (compatibility.length > 0) {
        if (lines.length > 0) {
          lines.push("");
        }
        lines.push(theme.warn("Compatibility:"));
        for (const notice of compatibility) {
          const marker = notice.severity === "warn" ? theme.warn("warn") : theme.muted("info");
          lines.push(`- ${formatPluginCompatibilityNotice(notice)} [${marker}]`);
        }
      }
      const docs = formatDocsLink("/plugin", "docs.coreblow.com/plugin");
      lines.push("");
      lines.push(`${theme.muted("Docs:")} ${docs}`);
      defaultRuntime.log(lines.join("\n"));
    });

  const marketplace = plugins
    .command("marketplace")
    .description("Inspect Claude-compatible plugin marketplaces");

  marketplace
    .command("list")
    .description("List plugins published by a marketplace source")
    .argument("<source>", "Local marketplace path/repo or git/GitHub source")
    .option("--json", "Print JSON")
    .action(async (source: string, opts: PluginMarketplaceListOptions) => {
      const result = await listMarketplacePlugins({
        marketplace: source,
        logger: createPluginInstallLogger(),
      });
      if (!result.ok) {
        defaultRuntime.error(result.error);
        return defaultRuntime.exit(1);
      }

      if (opts.json) {
        defaultRuntime.writeJson({
          source: result.sourceLabel,
          name: result.manifest.name,
          version: result.manifest.version,
          plugins: result.manifest.plugins,
        });
        return;
      }

      if (result.manifest.plugins.length === 0) {
        defaultRuntime.log(`No plugins found in marketplace ${result.sourceLabel}.`);
        return;
      }

      defaultRuntime.log(
        `${theme.heading("Marketplace")} ${theme.muted(result.manifest.name ?? result.sourceLabel)}`,
      );
      for (const plugin of result.manifest.plugins) {
        const suffix = plugin.version ? theme.muted(` v${plugin.version}`) : "";
        const desc = plugin.description ? ` - ${theme.muted(plugin.description)}` : "";
        defaultRuntime.log(`${theme.command(plugin.name)}${suffix}${desc}`);
      }
    });
}
