import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import officialExternalChannelCatalog from "../../scripts/lib/official-external-channel-catalog.json" with { type: "json" };
import officialExternalPluginCatalog from "../../scripts/lib/official-external-plugin-catalog.json" with { type: "json" };
import officialExternalProviderCatalog from "../../scripts/lib/official-external-provider-catalog.json" with { type: "json" };
import { MANIFEST_KEY } from "../compat/legacy-names.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";
import type {
  PluginManifestChannelConfig,
  PluginManifestContracts,
  PluginPackageInstall,
} from "./manifest.js";

type ManifestKey = typeof MANIFEST_KEY;

export type OfficialExternalProviderAuthChoice = {
  method?: string;
  choiceId?: string;
  choiceLabel?: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation" | "music-generation")[];
};

export type OfficialExternalProviderCatalogProvider = {
  id?: string;
  name?: string;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly OfficialExternalProviderAuthChoice[];
};

export type OfficialExternalWebSearchProvider = {
  id?: string;
  label?: string;
  hint?: string;
  onboardingScopes?: readonly "text-inference"[];
  requiresCredential?: boolean;
  credentialLabel?: string;
  envVars?: readonly string[];
  placeholder?: string;
  signupUrl?: string;
  docsUrl?: string;
  credentialPath?: string;
  autoDetectOrder?: number;
};

export type OfficialExternalPluginCatalogManifest = {
  plugin?: {
    id?: string;
    label?: string;
  };
  channel?: {
    id?: string;
    label?: string;
  };
  providers?: readonly OfficialExternalProviderCatalogProvider[];
  webSearchProviders?: readonly OfficialExternalWebSearchProvider[];
  install?: PluginPackageInstall;
  contracts?: PluginManifestContracts;
  channelConfigs?: Record<string, PluginManifestChannelConfig>;
};

export type OfficialExternalPluginCatalogEntry = {
  name?: string;
  version?: string;
  description?: string;
  source?: string;
  kind?: string;
} & Partial<Record<ManifestKey | "openclaw", OfficialExternalPluginCatalogManifest>>;

const OFFICIAL_CATALOG_SOURCES = [
  officialExternalChannelCatalog,
  officialExternalProviderCatalog,
  officialExternalPluginCatalog,
] as const;

function parseCatalogEntries(raw: unknown): OfficialExternalPluginCatalogEntry[] {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is OfficialExternalPluginCatalogEntry => isRecord(entry));
  }
  if (!isRecord(raw)) {
    return [];
  }
  const list = (raw as Record<string, unknown>).entries ??
    (raw as Record<string, unknown>).packages ??
    (raw as Record<string, unknown>).plugins;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((entry): entry is OfficialExternalPluginCatalogEntry => isRecord(entry));
}

function normalizeDefaultChoice(value: unknown): PluginPackageInstall["defaultChoice"] | undefined {
  return value === "corehub" || value === "clawhub" || value === "npm" || value === "local" ? value : undefined;
}

export function getOfficialExternalPluginCatalogManifest(
  entry: OfficialExternalPluginCatalogEntry,
): OfficialExternalPluginCatalogManifest | undefined {
  const manifest = entry[MANIFEST_KEY] ?? (entry as Record<string, unknown>)["openclaw"];
  return isRecord(manifest) ? (manifest as OfficialExternalPluginCatalogManifest) : undefined;
}

export function resolveOfficialExternalPluginId(
  entry: OfficialExternalPluginCatalogEntry,
): string | undefined {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  return (
    normalizeOptionalString(manifest?.plugin?.id) ??
    normalizeOptionalString(manifest?.channel?.id) ??
    normalizeOptionalString(manifest?.providers?.[0]?.id)
  );
}

function resolveOfficialExternalPluginLookupIds(
  entry: OfficialExternalPluginCatalogEntry,
): string[] {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  return [
    normalizeOptionalString(manifest?.plugin?.id),
    normalizeOptionalString(manifest?.channel?.id),
    normalizeOptionalString(manifest?.providers?.[0]?.id),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

export function resolveOfficialExternalPluginLabel(
  entry: OfficialExternalPluginCatalogEntry,
): string {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  return (
    normalizeOptionalString(manifest?.plugin?.label) ??
    normalizeOptionalString(manifest?.channel?.label) ??
    normalizeOptionalString(manifest?.providers?.[0]?.name) ??
    normalizeOptionalString(entry.name) ??
    resolveOfficialExternalPluginId(entry) ??
    "plugin"
  );
}

export function resolveOfficialExternalPluginInstall(
  entry: OfficialExternalPluginCatalogEntry,
): PluginPackageInstall | null {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  const install = manifest?.install;
  const rawCorehubSpec = normalizeOptionalString(install?.corehubSpec);
  const rawClawhubSpec = normalizeOptionalString(install?.clawhubSpec);
  const corehubSpec =
    rawCorehubSpec ??
    (rawClawhubSpec ? rawClawhubSpec.replace(/^clawhub:/, "corehub:") : undefined);
  const clawhubSpec =
    rawClawhubSpec ??
    (corehubSpec ? corehubSpec.replace(/^corehub:/, "clawhub:") : undefined);
  const npmSpec = normalizeOptionalString(install?.npmSpec) ?? normalizeOptionalString(entry.name);
  const localPath = normalizeOptionalString(install?.localPath);
  if (!corehubSpec && !clawhubSpec && !npmSpec && !localPath) {
    return null;
  }
  const defaultChoice =
    normalizeDefaultChoice(install?.defaultChoice) ??
    (corehubSpec ? "corehub" : npmSpec ? "npm" : clawhubSpec ? "clawhub" : localPath ? "local" : undefined);
  return {
    ...(corehubSpec ? { corehubSpec } : {}),
    ...(clawhubSpec ? { clawhubSpec } : {}),
    ...(npmSpec ? { npmSpec } : {}),
    ...(localPath ? { localPath } : {}),
    ...(defaultChoice ? { defaultChoice } : {}),
    ...(install?.minHostVersion ? { minHostVersion: install.minHostVersion } : {}),
    ...(install?.expectedIntegrity ? { expectedIntegrity: install.expectedIntegrity } : {}),
    ...(install?.allowInvalidConfigRecovery === true ? { allowInvalidConfigRecovery: true } : {}),
  };
}

export function listOfficialExternalPluginCatalogEntries(): OfficialExternalPluginCatalogEntry[] {
  const entries = OFFICIAL_CATALOG_SOURCES.flatMap((source) => parseCatalogEntries(source));
  const resolved = new Map<string, OfficialExternalPluginCatalogEntry>();
  for (const entry of entries) {
    const pluginId = resolveOfficialExternalPluginId(entry);
    const key = pluginId ? `${entry.kind ?? "plugin"}:${pluginId}` : (entry.name ?? "");
    if (key && !resolved.has(key)) {
      resolved.set(key, entry);
    }
  }
  return [...resolved.values()];
}

export function listOfficialExternalChannelCatalogEntries(): OfficialExternalPluginCatalogEntry[] {
  return listOfficialExternalPluginCatalogEntries().filter((entry) =>
    Boolean(getOfficialExternalPluginCatalogManifest(entry)?.channel),
  );
}

export function listOfficialExternalProviderCatalogEntries(): OfficialExternalPluginCatalogEntry[] {
  return listOfficialExternalPluginCatalogEntries().filter(
    (entry) => (getOfficialExternalPluginCatalogManifest(entry)?.providers?.length ?? 0) > 0,
  );
}

export function getOfficialExternalPluginCatalogEntry(
  pluginId: string,
): OfficialExternalPluginCatalogEntry | undefined {
  const normalized = pluginId.trim();
  if (!normalized) {
    return undefined;
  }
  return listOfficialExternalPluginCatalogEntries().find((entry) =>
    resolveOfficialExternalPluginLookupIds(entry).includes(normalized),
  );
}

export function getOfficialExternalPluginCatalogEntryForPackage(
  packageName: string | undefined,
): OfficialExternalPluginCatalogEntry | undefined {
  const normalized = packageName?.trim();
  if (!normalized) {
    return undefined;
  }
  return listOfficialExternalPluginCatalogEntries().find((entry) => {
    const entryName = normalizeOptionalString(entry.name);
    if (entryName === normalized) {
      return true;
    }
    // Backward-compatible fallback lookup: @openclaw/* <-> @coreblow/*
    if (normalized.startsWith("@openclaw/") && entryName === `@coreblow/${normalized.slice(10)}`) {
      return true;
    }
    if (normalized.startsWith("@coreblow/") && entryName === `@openclaw/${normalized.slice(10)}`) {
      return true;
    }
    const manifest = getOfficialExternalPluginCatalogManifest(entry);
    const npmSpec = normalizeOptionalString(manifest?.install?.npmSpec);
    if (npmSpec === normalized) {
      return true;
    }
    if (normalized.startsWith("@openclaw/") && npmSpec === `@coreblow/${normalized.slice(10)}`) {
      return true;
    }
    if (normalized.startsWith("@coreblow/") && npmSpec === `@openclaw/${normalized.slice(10)}`) {
      return true;
    }
    return false;
  });
}

export interface ArtifactChecksumMismatch {
  readonly channelId: string;
  readonly file: string;
  readonly expectedSha256: string;
  readonly actualSha256: string;
}

export interface MalformedCatalogChecksum {
  readonly channelId: string;
  readonly reason: string;
}

export interface OfficialArtifactVerification {
  readonly status: "certified" | "pending_external_artifact" | "failed";
  readonly totalChannels: number;
  readonly verifiedCount: number;
  readonly missingCount: number;
  readonly missingArtifacts: readonly string[];
  readonly checksumMismatches: readonly ArtifactChecksumMismatch[];
  readonly malformedCatalogChecksums: readonly MalformedCatalogChecksum[];
  readonly artifactsDir?: string;
  readonly catalogPath?: string;
  readonly reason: string;
}

export interface VerifyOfficialChannelArtifactsOptions {
  readonly catalogPath?: string;
  readonly artifactsDir?: string;
  readonly channelIds?: readonly string[];
}

function timingSafeHexEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return actual.toLowerCase() === expected.toLowerCase();
  }
}

function timingSafeStringEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return actual === expected;
  }
}

/**
 * Cryptographic SHA-256 verification of official channel release archives against canonical catalog metadata.
 * Returns 'certified' ONLY when all required channel artifacts exist and cryptographically match their SHA-256 digest.
 */
export function verifyOfficialChannelArtifacts(
  options: VerifyOfficialChannelArtifactsOptions = {},
): OfficialArtifactVerification {
  const targetChannelIds: string[] = options.channelIds
    ? [...options.channelIds]
    : [
        "discord",
        "matrix",
        "twitch",
        "feishu",
        "line",
        "zalo",
        "zalouser",
        "qqbot",
        "mattermost",
        "nextcloud-talk",
        "synology-chat",
        "tlon",
        "nostr",
        "irc",
        "msteams",
      ];

  // 1. Resolve canonical catalog path
  let foundCatalogPath: string | undefined;
  if (options.catalogPath) {
    if (fs.existsSync(options.catalogPath)) {
      foundCatalogPath = options.catalogPath;
    } else {
      return {
        status: "pending_external_artifact",
        totalChannels: targetChannelIds.length,
        verifiedCount: 0,
        missingCount: targetChannelIds.length,
        missingArtifacts: targetChannelIds,
        checksumMismatches: [],
        malformedCatalogChecksums: [],
        catalogPath: options.catalogPath,
        artifactsDir: options.artifactsDir,
        reason: `Canonical CoreHub catalog not found at specified path: ${options.catalogPath}`,
      };
    }
  } else {
    const candidateCatalogPaths = [
      process.env.COREHUB_CATALOG_PATH,
      path.resolve(process.cwd(), "corehub/catalog.json"),
      path.resolve(process.cwd(), "coreblow-split/corehub/catalog.json"),
      path.resolve(process.cwd(), "../coreblow-split/corehub/catalog.json"),
      path.resolve(os.homedir(), "coreblow-split/corehub/catalog.json"),
      path.resolve(os.homedir(), ".coreblow/corehub/catalog.json"),
    ].filter((p): p is string => typeof p === "string" && p.length > 0);

    for (const p of candidateCatalogPaths) {
      if (fs.existsSync(p)) {
        foundCatalogPath = p;
        break;
      }
    }
  }

  if (!foundCatalogPath) {
    return {
      status: "pending_external_artifact",
      totalChannels: targetChannelIds.length,
      verifiedCount: 0,
      missingCount: targetChannelIds.length,
      missingArtifacts: targetChannelIds,
      checksumMismatches: [],
      malformedCatalogChecksums: [],
      artifactsDir: options.artifactsDir,
      reason:
        "Canonical CoreHub catalog 'catalog.json' not found on disk. Release archives cannot be verified without catalog metadata.",
    };
  }

  // 2. Read and parse catalog JSON
  let catalogEntries: unknown[] = [];
  try {
    const raw = fs.readFileSync(foundCatalogPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      catalogEntries = parsed;
    } else if (Array.isArray(parsed.entries)) {
      catalogEntries = parsed.entries;
    } else if (Array.isArray(parsed.packages)) {
      catalogEntries = parsed.packages;
    } else if (isRecord(parsed)) {
      catalogEntries = Object.values(parsed);
    }
  } catch {
    return {
      status: "pending_external_artifact",
      totalChannels: targetChannelIds.length,
      verifiedCount: 0,
      missingCount: targetChannelIds.length,
      missingArtifacts: targetChannelIds,
      checksumMismatches: [],
      malformedCatalogChecksums: [],
      catalogPath: foundCatalogPath,
      artifactsDir: options.artifactsDir,
      reason: `Canonical CoreHub catalog at ${foundCatalogPath} contains malformed or unparsable JSON.`,
    };
  }

  // 3. Resolve artifacts directory
  let foundArtifactsDir: string | undefined;
  if (options.artifactsDir) {
    if (fs.existsSync(options.artifactsDir)) {
      foundArtifactsDir = options.artifactsDir;
    } else {
      return {
        status: "pending_external_artifact",
        totalChannels: targetChannelIds.length,
        verifiedCount: 0,
        missingCount: targetChannelIds.length,
        missingArtifacts: targetChannelIds,
        checksumMismatches: [],
        malformedCatalogChecksums: [],
        catalogPath: foundCatalogPath,
        artifactsDir: options.artifactsDir,
        reason: `Release archive directory not found at specified path: ${options.artifactsDir}`,
      };
    }
  } else {
    const candidateArtifactDirs = [
      process.env.COREHUB_ARTIFACTS_DIR,
      path.resolve(process.cwd(), "corehub/artifacts"),
      path.resolve(process.cwd(), "coreblow-split/corehub/artifacts"),
      path.resolve(process.cwd(), "../coreblow-split/corehub/artifacts"),
      path.resolve(os.homedir(), "coreblow-split/corehub/artifacts"),
      path.resolve(os.homedir(), ".coreblow/corehub/artifacts"),
    ].filter((p): p is string => typeof p === "string" && p.length > 0);

    for (const dir of candidateArtifactDirs) {
      if (fs.existsSync(dir)) {
        foundArtifactsDir = dir;
        break;
      }
    }
  }

  if (!foundArtifactsDir) {
    return {
      status: "pending_external_artifact",
      totalChannels: targetChannelIds.length,
      verifiedCount: 0,
      missingCount: targetChannelIds.length,
      missingArtifacts: targetChannelIds,
      checksumMismatches: [],
      malformedCatalogChecksums: [],
      catalogPath: foundCatalogPath,
      artifactsDir: options.artifactsDir,
      reason:
        "Release archive directory 'corehub/artifacts/' is not vendored in this monorepo checkout. Channel binary packages are distributed via the satellite CoreHub registry.",
    };
  }

  // 4. Cryptographically verify each channel artifact against expected SHA-256
  const missingArtifacts: string[] = [];
  const checksumMismatches: ArtifactChecksumMismatch[] = [];
  const malformedCatalogChecksums: MalformedCatalogChecksum[] = [];
  let verifiedCount = 0;

  const filesInArtifactsDir = fs.readdirSync(foundArtifactsDir);

  for (const rawId of targetChannelIds) {
    const channelId = rawId.replace(/^@coreblow\//, "").trim();

    // Find entry in catalog
    const entry = catalogEntries.find((e: any) => {
      if (!isRecord(e)) return false;
      const id = String(e.id ?? e.name ?? "").replace(/^@coreblow\//, "");
      const channelSubId =
        isRecord(e.coreblow) && isRecord((e.coreblow as any).channel)
          ? String((e.coreblow as any).channel.id)
          : isRecord(e.openclaw) && isRecord((e.openclaw as any).channel)
            ? String((e.openclaw as any).channel.id)
            : undefined;
      return id === channelId || channelSubId === channelId;
    }) as Record<string, unknown> | undefined;

    if (!entry) {
      malformedCatalogChecksums.push({
        channelId,
        reason: `No catalog entry found for channel "${channelId}".`,
      });
      continue;
    }

    // Resolve expected artifact name and sha256
    let expectedArtifactName: string | undefined;
    let rawExpectedSha: string | undefined;

    const versions = Array.isArray(entry.versions) ? entry.versions : undefined;
    const latestVersion = versions?.find((v: any) => v.tag === "latest") ?? versions?.[0];
    if (isRecord(latestVersion) && isRecord(latestVersion.artifact)) {
      expectedArtifactName =
        typeof latestVersion.artifact.name === "string" ? latestVersion.artifact.name : undefined;
      rawExpectedSha =
        typeof latestVersion.artifact.sha256 === "string"
          ? latestVersion.artifact.sha256
          : undefined;
    }

    if (!rawExpectedSha && isRecord(entry.artifact)) {
      expectedArtifactName =
        typeof (entry.artifact as any).name === "string"
          ? (entry.artifact as any).name
          : expectedArtifactName;
      rawExpectedSha =
        typeof (entry.artifact as any).sha256 === "string"
          ? (entry.artifact as any).sha256
          : undefined;
    }

    if (!rawExpectedSha && isRecord(entry.install)) {
      const inst = entry.install as Record<string, unknown>;
      rawExpectedSha =
        typeof inst.sha256 === "string"
          ? inst.sha256
          : typeof inst.expectedIntegrity === "string"
            ? inst.expectedIntegrity
            : undefined;
    }

    if (!rawExpectedSha || typeof rawExpectedSha !== "string" || !rawExpectedSha.trim()) {
      malformedCatalogChecksums.push({
        channelId,
        reason: `Missing SHA-256 digest in catalog entry for "${channelId}".`,
      });
      continue;
    }

    const cleanExpectedSha = rawExpectedSha.trim().toLowerCase().replace(/^sha256-/, "");
    const isSha512 = rawExpectedSha.startsWith("sha512-");
    const isSha256 = !isSha512 && /^[a-f0-9]{64}$/.test(cleanExpectedSha);

    if (!isSha256 && !isSha512) {
      malformedCatalogChecksums.push({
        channelId,
        reason: `Malformed checksum digest in catalog for "${channelId}": "${rawExpectedSha}".`,
      });
      continue;
    }

    // Locate artifact file on disk
    let artifactFileName: string | undefined;
    if (expectedArtifactName && filesInArtifactsDir.includes(expectedArtifactName)) {
      artifactFileName = expectedArtifactName;
    } else {
      const found = filesInArtifactsDir.find(
        (f) =>
          f === `${channelId}.tgz` ||
          (f.startsWith(`${channelId}-`) &&
            (f.endsWith(".coreblow-plugin.tgz") || f.endsWith(".tgz"))),
      );
      if (found) {
        artifactFileName = found;
      }
    }

    if (!artifactFileName) {
      missingArtifacts.push(channelId);
      continue;
    }

    // Hash real file on disk using Node crypto
    const artifactPath = path.join(foundArtifactsDir, artifactFileName);
    let fileBuffer: Buffer;
    try {
      fileBuffer = fs.readFileSync(artifactPath);
    } catch {
      missingArtifacts.push(channelId);
      continue;
    }

    if (isSha512) {
      const actualSha512 =
        "sha512-" + crypto.createHash("sha512").update(fileBuffer).digest("base64");
      if (timingSafeStringEqual(actualSha512, rawExpectedSha.trim())) {
        verifiedCount++;
      } else {
        checksumMismatches.push({
          channelId,
          file: artifactFileName,
          expectedSha256: rawExpectedSha.trim(),
          actualSha256: actualSha512,
        });
      }
    } else {
      const actualSha256 = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex")
        .toLowerCase();
      if (timingSafeHexEqual(actualSha256, cleanExpectedSha)) {
        verifiedCount++;
      } else {
        checksumMismatches.push({
          channelId,
          file: artifactFileName,
          expectedSha256: cleanExpectedSha,
          actualSha256,
        });
      }
    }
  }

  const totalChannels = targetChannelIds.length;
  const missingCount = missingArtifacts.length + malformedCatalogChecksums.length;

  if (checksumMismatches.length > 0) {
    return {
      status: "failed",
      totalChannels,
      verifiedCount,
      missingCount,
      missingArtifacts,
      checksumMismatches,
      malformedCatalogChecksums,
      catalogPath: foundCatalogPath,
      artifactsDir: foundArtifactsDir,
      reason: `Cryptographic checksum verification failed for ${checksumMismatches.length} channel artifact(s).`,
    };
  }

  if (malformedCatalogChecksums.length > 0) {
    return {
      status: "pending_external_artifact",
      totalChannels,
      verifiedCount,
      missingCount,
      missingArtifacts,
      checksumMismatches,
      malformedCatalogChecksums,
      catalogPath: foundCatalogPath,
      artifactsDir: foundArtifactsDir,
      reason: `Catalog metadata missing or malformed for ${malformedCatalogChecksums.length} channel(s).`,
    };
  }

  if (verifiedCount === totalChannels && totalChannels > 0 && missingCount === 0) {
    return {
      status: "certified",
      totalChannels,
      verifiedCount,
      missingCount: 0,
      missingArtifacts: [],
      checksumMismatches: [],
      malformedCatalogChecksums: [],
      catalogPath: foundCatalogPath,
      artifactsDir: foundArtifactsDir,
      reason: `All ${verifiedCount} required channel artifacts cryptographically certified with matching SHA-256 digests in ${foundArtifactsDir}.`,
    };
  }

  return {
    status: "pending_external_artifact",
    totalChannels,
    verifiedCount,
    missingCount: totalChannels - verifiedCount,
    missingArtifacts,
    checksumMismatches,
    malformedCatalogChecksums,
    catalogPath: foundCatalogPath,
    artifactsDir: foundArtifactsDir,
    reason: `${totalChannels - verifiedCount} of ${totalChannels} channel artifacts are missing or unverified in ${foundArtifactsDir}.`,
  };
}
