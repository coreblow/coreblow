import {
  CoreHubRequestError,
  downloadCoreHubPackageArchive,
  downloadCoreHubSkillArchive,
  fetchCoreHubPackageDetail,
  fetchCoreHubPackageVersion,
  fetchCoreHubSkillDetail,
  formatSha256Integrity,
  isCoreHubFamilySkill,
  listCoreHubSkills,
  parseCoreHubPluginSpec,
  resolveCoreHubAuthToken,
  resolveCoreHubBaseUrl,
  resolveLatestVersionFromPackage,
  satisfiesGatewayMinimum,
  satisfiesPluginApiRange,
  searchCoreHubPackages,
  searchCoreHubSkills,
  type CoreHubDownloadResult,
  type CoreHubPackageChannel,
  type CoreHubPackageCompatibility,
  type CoreHubPackageDetail,
  type CoreHubPackageFamily,
  type CoreHubPackageListItem,
  type CoreHubPackageSearchResult,
  type CoreHubPackageVersion,
  type CoreHubSkillDetail,
  type CoreHubSkillListResponse,
  type CoreHubSkillSearchResult,
} from "./coreblow-hub.js";

export { satisfiesGatewayMinimum, satisfiesPluginApiRange };
export { CoreHubRequestError as ClawHubRequestError };
export { formatSha256Integrity };

export type ClawHubPackageFamily = CoreHubPackageFamily;
export type ClawHubPackageChannel = CoreHubPackageChannel;
export type ClawHubPackageCompatibility = CoreHubPackageCompatibility;
export type ClawHubPackageListItem = CoreHubPackageListItem;
export type ClawHubPackageDetail = CoreHubPackageDetail;
export type ClawHubPackageVersion = CoreHubPackageVersion;
export type ClawHubPackageSearchResult = CoreHubPackageSearchResult;
export type ClawHubSkillSearchResult = CoreHubSkillSearchResult;
export type ClawHubSkillDetail = CoreHubSkillDetail;
export type ClawHubSkillListResponse = CoreHubSkillListResponse;
export type ClawHubDownloadResult = CoreHubDownloadResult;

export type ClawHubPackageHostTarget = {
  os?: string | null;
  arch?: string | null;
  libc?: string | null;
  key?: string | null;
};

export type ClawHubPackageEnvironmentSummary = {
  requiresLocalDesktop?: boolean;
  requiresBrowser?: boolean;
  requiresAudioDevice?: boolean;
  requiresNetwork?: boolean;
  requiresExternalServices?: string[];
  requiresOsPermissions?: string[];
  supportsRemoteHost?: boolean;
  knownUnsupported?: string[];
};

export type ClawHubPackageArtifactSummary = {
  kind?: string | null;
  sha256?: string | null;
  size?: number | null;
  format?: string | null;
  npmIntegrity?: string | null;
  npmShasum?: string | null;
  npmTarballName?: string | null;
  downloadUrl?: string | null;
};

export type ClawHubArtifactKind = "legacy-zip" | "npm-pack";
export type ClawHubArtifactScanState =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "not-run"
  | (string & {});
export type ClawHubArtifactModerationState = "approved" | "quarantined" | "revoked" | (string & {});
export type ClawHubPackageSecurityState =
  | "pending"
  | "approved"
  | "limited"
  | "quarantined"
  | "rejected"
  | "revoked"
  | (string & {});

export type ClawHubPackageClawPackSummary = {
  available: boolean;
  specVersion?: number | null;
  format?: string | null;
  sha256?: string | null;
  size?: number | null;
  manifestSha256?: string | null;
  npmIntegrity?: string | null;
  npmShasum?: string | null;
  npmTarballName?: string | null;
};

export type ClawHubResolvedArtifact = {
  source: "clawhub" | "corehub";
  artifactKind: ClawHubArtifactKind;
  packageName: string;
  version: string;
  downloadUrl?: string | null;
  artifactSha256?: string | null;
  npmIntegrity?: string | null;
  npmShasum?: string | null;
  scanState?: ClawHubArtifactScanState | null;
  moderationState?: ClawHubArtifactModerationState | null;
};

export type ClawHubPackageArtifactResolverResponse = {
  package?: {
    name?: string | null;
    displayName?: string | null;
    family?: ClawHubPackageFamily | (string & {}) | null;
  } | null;
  version?: CoreHubPackageVersion["version"] | string | null;
  artifact?: ClawHubResolvedArtifact | null;
};

export type ClawHubPackageSecurityResponse = {
  packageId?: string | null;
  releaseId?: string | null;
  state: ClawHubPackageSecurityState;
  reasonCode?: string | null;
  moderatorNote?: string | null;
  actorId?: string | null;
  createdAt?: number | null;
  scanState?: ClawHubArtifactScanState | null;
  moderationState?: ClawHubArtifactModerationState | null;
};

export type ClawHubPackageReadinessPhase =
  | "planned"
  | "published"
  | "metadata-ready"
  | "blocked"
  | "ready-for-openclaw"
  | "ready-for-coreblow"
  | (string & {});

export type ClawHubPackageReadiness = {
  ready?: boolean | null;
  readyForOpenClaw?: boolean | null;
  readyForCoreBlow?: boolean | null;
  installReady?: boolean | null;
  phase?: ClawHubPackageReadinessPhase | null;
  status?: ClawHubPackageReadinessPhase | null;
  package?: {
    name?: string | null;
    family?: ClawHubPackageFamily | (string & {}) | null;
    channel?: ClawHubPackageChannel | (string & {}) | null;
    isOfficial?: boolean | null;
  } | null;
  packageName?: string | null;
  artifactKind?: ClawHubArtifactKind | (string & {}) | null;
  blockers?: string[];
  scanState?: ClawHubArtifactScanState | null;
  moderationState?: ClawHubArtifactModerationState | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function normalizeLegacySpec(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("clawhub:")) {
    return `corehub:${trimmed.slice("clawhub:".length).trim()}`;
  }
  return trimmed;
}

function normalizeLegacyBaseUrl(baseUrl?: string): string | undefined {
  return (
    baseUrl ??
    process.env.COREBLOW_COREHUB_URL ??
    process.env.COREHUB_URL ??
    process.env.OPENCLAW_CLAWHUB_URL ??
    process.env.CLAWHUB_URL
  );
}

export async function resolveClawHubAuthToken(): Promise<string | undefined> {
  return resolveCoreHubAuthToken();
}

export function resolveClawHubBaseUrl(baseUrl?: string): string {
  return resolveCoreHubBaseUrl(normalizeLegacyBaseUrl(baseUrl));
}

export function parseClawHubPluginSpec(raw: string): {
  name: string;
  version?: string;
  baseUrl?: string;
} | null {
  return parseCoreHubPluginSpec(normalizeLegacySpec(raw));
}

export function normalizeClawHubSha256Integrity(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const prefixedBase64 = /^sha256-([A-Za-z0-9+/]+={0,2})$/.exec(trimmed);
  if (prefixedBase64?.[1]) {
    const decoded = Buffer.from(prefixedBase64[1], "base64");
    return decoded.length === 32 ? `sha256-${decoded.toString("base64")}` : null;
  }
  const prefixedHex = /^sha256:([A-Fa-f0-9]{64})$/.exec(trimmed);
  const hex = prefixedHex?.[1] ?? (/^[A-Fa-f0-9]{64}$/.test(trimmed) ? trimmed : null);
  return hex ? `sha256-${Buffer.from(hex, "hex").toString("base64")}` : null;
}

export function normalizeClawHubSha256Hex(value: string): string | null {
  const trimmed = value.trim();
  return /^[A-Fa-f0-9]{64}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export async function fetchClawHubPackageDetail(params: {
  name: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubPackageDetail> {
  return fetchCoreHubPackageDetail({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function fetchClawHubPackageVersion(params: {
  name: string;
  version: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubPackageVersion> {
  return fetchCoreHubPackageVersion({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function fetchClawHubPackageArtifact(params: {
  name: string;
  version: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubPackageArtifactResolverResponse> {
  const version = await fetchClawHubPackageVersion(params);
  return {
    package: version.package,
    version: version.version,
    artifact: version.version?.artifact
      ? {
          source: "corehub",
          artifactKind: "legacy-zip",
          packageName: params.name,
          version: version.version.version,
          artifactSha256: version.version.artifact.sha256 ?? null,
        }
      : null,
  };
}

export async function fetchClawHubPackageSecurity(
  _params: {
    name: string;
    version?: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  },
): Promise<ClawHubPackageSecurityResponse> {
  return { state: "approved" };
}

export async function fetchClawHubPackageReadiness(params: {
  name: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubPackageReadiness> {
  const detail = await fetchClawHubPackageDetail(params);
  return {
    ready: Boolean(detail.package),
    readyForCoreBlow: Boolean(detail.package),
    readyForOpenClaw: Boolean(detail.package),
    installReady: Boolean(detail.package),
    phase: detail.package ? "ready-for-coreblow" : "blocked",
    status: detail.package ? "ready-for-coreblow" : "blocked",
    package: detail.package
      ? {
          name: detail.package.name,
          family: detail.package.family,
          channel: detail.package.channel,
          isOfficial: detail.package.isOfficial,
        }
      : null,
    packageName: detail.package?.name ?? params.name,
  };
}

export async function searchClawHubPackages(params: {
  query: string;
  family?: ClawHubPackageFamily;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<ClawHubPackageSearchResult[]> {
  return searchCoreHubPackages({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function searchClawHubSkills(params: {
  query: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<ClawHubSkillSearchResult[]> {
  return searchCoreHubSkills({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function fetchClawHubSkillDetail(params: {
  slug: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubSkillDetail> {
  return fetchCoreHubSkillDetail({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function listClawHubSkills(params: {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<ClawHubSkillListResponse> {
  return listCoreHubSkills({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function downloadClawHubPackageArchive(params: {
  name: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubDownloadResult> {
  return downloadCoreHubPackageArchive({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export async function downloadClawHubSkillArchive(params: {
  slug: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubDownloadResult> {
  return downloadCoreHubSkillArchive({
    ...params,
    baseUrl: normalizeLegacyBaseUrl(params.baseUrl),
  });
}

export { resolveLatestVersionFromPackage };

export function isClawHubFamilySkill(detail: ClawHubPackageDetail | ClawHubSkillDetail): boolean {
  return isCoreHubFamilySkill(detail);
}
