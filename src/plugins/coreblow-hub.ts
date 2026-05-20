import fs from "node:fs/promises";
import path from "node:path";
import {
  CoreHubRequestError,
  downloadCoreHubPackageArchive,
  fetchCoreHubPackageDetail,
  fetchCoreHubPackageVersion,
  parseCoreHubPluginSpec,
  resolveLatestVersionFromPackage,
  satisfiesGatewayMinimum,
  satisfiesPluginApiRange,
  type CoreHubPackageChannel,
  type CoreHubPackageCompatibility,
  type CoreHubPackageDetail,
  type CoreHubPackageFamily,
} from "../infra/coreblow-hub.js";
import { resolveCompatibilityHostVersion } from "../version.js";
import { installPluginFromArchive, type InstallPluginResult } from "./install.js";

export const COREHUB_INSTALL_ERROR_CODE = {
  INVALID_SPEC: "invalid_spec",
  PACKAGE_NOT_FOUND: "package_not_found",
  VERSION_NOT_FOUND: "version_not_found",
  NO_INSTALLABLE_VERSION: "no_installable_version",
  SKILL_PACKAGE: "skill_package",
  UNSUPPORTED_FAMILY: "unsupported_family",
  PRIVATE_PACKAGE: "private_package",
  INCOMPATIBLE_PLUGIN_API: "incompatible_plugin_api",
  INCOMPATIBLE_GATEWAY: "incompatible_gateway",
} as const;

export type CoreHubInstallErrorCode =
  (typeof COREHUB_INSTALL_ERROR_CODE)[keyof typeof COREHUB_INSTALL_ERROR_CODE];

type PluginInstallLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

export type CoreHubPluginInstallRecordFields = {
  source: "corehub";
  corehubUrl: string;
  corehubPackage: string;
  corehubFamily: Exclude<CoreHubPackageFamily, "skill">;
  corehubChannel?: CoreHubPackageChannel;
  version?: string;
  integrity?: string;
  resolvedAt?: string;
  installedAt?: string;
  artifactSha256?: string;
  artifactSize?: number;
  artifactManifestVerified?: boolean;
  artifactManifestSha256?: string;
  artifactStorageKey?: string;
  publisherHandle?: string;
  verifiedAt?: string;
};

type CoreHubInstallFailure = {
  ok: false;
  error: string;
  code?: CoreHubInstallErrorCode;
};

export function formatCoreHubSpecifier(params: { name: string; version?: string }): string {
  return `corehub:${params.name}${params.version ? `@${params.version}` : ""}`;
}

function buildCoreHubInstallFailure(
  error: string,
  code?: CoreHubInstallErrorCode,
): CoreHubInstallFailure {
  return { ok: false, error, code };
}

function mapCoreHubRequestError(
  error: unknown,
  context: { stage: "package" | "version"; name: string; version?: string },
): CoreHubInstallFailure {
  if (error instanceof CoreHubRequestError && error.status === 404) {
    if (context.stage === "package") {
      return buildCoreHubInstallFailure(
        "Package not found on CoreHub.",
        COREHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
      );
    }
    return buildCoreHubInstallFailure(
      `Version not found on CoreHub: ${context.name}@${context.version ?? "unknown"}.`,
      COREHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND,
    );
  }
  return buildCoreHubInstallFailure(error instanceof Error ? error.message : String(error));
}

function resolveRequestedVersion(params: {
  detail: CoreHubPackageDetail;
  requestedVersion?: string;
}): string | null {
  if (params.requestedVersion) {
    return params.requestedVersion;
  }
  return resolveLatestVersionFromPackage(params.detail);
}

async function resolveCompatiblePackageVersion(params: {
  detail: CoreHubPackageDetail;
  requestedVersion?: string;
  baseUrl?: string;
  token?: string;
}): Promise<
  | {
      ok: true;
      version: string;
      compatibility?: CoreHubPackageCompatibility | null;
    }
  | CoreHubInstallFailure
> {
  const version = resolveRequestedVersion(params);
  if (!version) {
    return buildCoreHubInstallFailure(
      `CoreHub package "${params.detail.package?.name ?? "unknown"}" has no installable version.`,
      COREHUB_INSTALL_ERROR_CODE.NO_INSTALLABLE_VERSION,
    );
  }
  let versionDetail;
  try {
    versionDetail = await fetchCoreHubPackageVersion({
      name: params.detail.package?.name ?? "",
      version,
      baseUrl: params.baseUrl,
      token: params.token,
    });
  } catch (error) {
    return mapCoreHubRequestError(error, {
      stage: "version",
      name: params.detail.package?.name ?? "unknown",
      version,
    });
  }
  return {
    ok: true,
    version,
    compatibility:
      versionDetail.version?.compatibility ?? params.detail.package?.compatibility ?? null,
  };
}

function validateCoreHubPluginPackage(params: {
  detail: CoreHubPackageDetail;
  compatibility?: CoreHubPackageCompatibility | null;
  runtimeVersion: string;
}): CoreHubInstallFailure | null {
  const pkg = params.detail.package;
  if (!pkg) {
    return buildCoreHubInstallFailure(
      "Package not found on CoreHub.",
      COREHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
    );
  }
  if (pkg.family === "skill") {
    return buildCoreHubInstallFailure(
      `"${pkg.name}" is a skill. Use "coreblow skills install ${pkg.name}" instead.`,
      COREHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
    );
  }
  if (pkg.family !== "code-plugin" && pkg.family !== "bundle-plugin") {
    return buildCoreHubInstallFailure(
      `Unsupported CoreHub package family: ${String(pkg.family)}`,
      COREHUB_INSTALL_ERROR_CODE.UNSUPPORTED_FAMILY,
    );
  }
  if (pkg.channel === "private") {
    return buildCoreHubInstallFailure(
      `"${pkg.name}" is private on CoreHub and cannot be installed anonymously.`,
      COREHUB_INSTALL_ERROR_CODE.PRIVATE_PACKAGE,
    );
  }

  const compatibility = params.compatibility;
  const runtimeVersion = params.runtimeVersion;
  if (
    compatibility?.pluginApiRange &&
    !satisfiesPluginApiRange(runtimeVersion, compatibility.pluginApiRange)
  ) {
    return buildCoreHubInstallFailure(
      `Plugin "${pkg.name}" requires plugin API ${compatibility.pluginApiRange}, but this CoreBlow runtime exposes ${runtimeVersion}.`,
      COREHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
    );
  }

  if (
    compatibility?.minGatewayVersion &&
    !satisfiesGatewayMinimum(runtimeVersion, compatibility.minGatewayVersion)
  ) {
    return buildCoreHubInstallFailure(
      `Plugin "${pkg.name}" requires CoreBlow >=${compatibility.minGatewayVersion}, but this host is ${runtimeVersion}.`,
      COREHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_GATEWAY,
    );
  }
  return null;
}

function logCoreHubPackageSummary(params: {
  detail: CoreHubPackageDetail;
  version: string;
  compatibility?: CoreHubPackageCompatibility | null;
  logger?: PluginInstallLogger;
}) {
  const pkg = params.detail.package;
  if (!pkg) {
    return;
  }
  const verification = pkg.verification?.tier ? ` verification=${pkg.verification.tier}` : "";
  params.logger?.info?.(
    `CoreHub ${pkg.family} ${pkg.name}@${params.version} channel=${pkg.channel}${verification}`,
  );
  const compatibilityParts = [
    params.compatibility?.pluginApiRange
      ? `pluginApi=${params.compatibility.pluginApiRange}`
      : null,
    params.compatibility?.minGatewayVersion
      ? `minGateway=${params.compatibility.minGatewayVersion}`
      : null,
  ].filter(Boolean);
  if (compatibilityParts.length > 0) {
    params.logger?.info?.(`Compatibility: ${compatibilityParts.join(" ")}`);
  }
  if (pkg.channel !== "official") {
    params.logger?.warn?.(
      `CoreHub package "${pkg.name}" is ${pkg.channel}; review source and verification before enabling.`,
    );
  }
}

export async function installPluginFromCoreHub(params: {
  spec: string;
  baseUrl?: string;
  token?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
  expectedPluginId?: string;
}): Promise<
  | ({
      ok: true;
    } & Extract<InstallPluginResult, { ok: true }> & {
        corehub: CoreHubPluginInstallRecordFields;
        packageName: string;
      })
  | CoreHubInstallFailure
  | Extract<InstallPluginResult, { ok: false }>
> {
  const parsed = parseCoreHubPluginSpec(params.spec);
  if (!parsed?.name) {
    return buildCoreHubInstallFailure(
      `invalid CoreHub plugin spec: ${params.spec}`,
      COREHUB_INSTALL_ERROR_CODE.INVALID_SPEC,
    );
  }

  params.logger?.info?.(`Resolving ${formatCoreHubSpecifier(parsed)}…`);
  let detail: CoreHubPackageDetail;
  try {
    detail = await fetchCoreHubPackageDetail({
      name: parsed.name,
      baseUrl: params.baseUrl,
      token: params.token,
    });
  } catch (error) {
    return mapCoreHubRequestError(error, {
      stage: "package",
      name: parsed.name,
    });
  }
  const versionState = await resolveCompatiblePackageVersion({
    detail,
    requestedVersion: parsed.version,
    baseUrl: params.baseUrl,
    token: params.token,
  });
  if (!versionState.ok) {
    return versionState;
  }
  const runtimeVersion = resolveCompatibilityHostVersion();
  const validationFailure = validateCoreHubPluginPackage({
    detail,
    compatibility: versionState.compatibility,
    runtimeVersion,
  });
  if (validationFailure) {
    return validationFailure;
  }
  logCoreHubPackageSummary({
    detail,
    version: versionState.version,
    compatibility: versionState.compatibility,
    logger: params.logger,
  });

  let archive;
  try {
    archive = await downloadCoreHubPackageArchive({
      name: parsed.name,
      version: versionState.version,
      baseUrl: params.baseUrl,
      token: params.token,
    });
  } catch (error) {
    return buildCoreHubInstallFailure(error instanceof Error ? error.message : String(error));
  }
  try {
    params.logger?.info?.(
      `Downloading ${detail.package?.family === "bundle-plugin" ? "bundle" : "plugin"} ${parsed.name}@${versionState.version} from CoreHub…`,
    );
    const installResult = await installPluginFromArchive({
      archivePath: archive.archivePath,
      logger: params.logger,
      mode: params.mode,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId,
    });
    if (!installResult.ok) {
      return installResult;
    }

    const pkg = detail.package!;
    const corehubFamily =
      pkg.family === "code-plugin" || pkg.family === "bundle-plugin" ? pkg.family : null;
    if (!corehubFamily) {
      return buildCoreHubInstallFailure(
        `Unsupported CoreHub package family: ${pkg.family}`,
        COREHUB_INSTALL_ERROR_CODE.UNSUPPORTED_FAMILY,
      );
    }
    const verifiedAt = new Date().toISOString();
    return {
      ...installResult,
      packageName: parsed.name,
      corehub: {
        source: "corehub",
        corehubUrl:
          params.baseUrl?.trim() ||
          process.env.COREBLOW_COREHUB_URL?.trim() ||
          "https://coreblow.com/corehub",
        corehubPackage: parsed.name,
        corehubFamily,
        corehubChannel: pkg.channel,
        version: installResult.version ?? versionState.version,
        integrity: archive.integrity,
        artifactSha256: archive.artifactSha256,
        artifactSize: archive.artifactSize,
        artifactManifestVerified: archive.artifactManifestVerified,
        artifactManifestSha256: archive.artifactManifestSha256,
        artifactStorageKey: archive.artifactStorageKey,
        publisherHandle: archive.publisherHandle ?? pkg.ownerHandle ?? detail.owner?.handle ?? undefined,
        resolvedAt: verifiedAt,
        verifiedAt,
      },
    };
  } finally {
    await fs.rm(archive.archivePath, { force: true }).catch(() => undefined);
    await fs
      .rm(path.dirname(archive.archivePath), { recursive: true, force: true })
      .catch(() => undefined);
  }
}
