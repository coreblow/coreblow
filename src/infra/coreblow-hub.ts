import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isAtLeast, parseSemver } from "./runtime-guard.js";
import { compareComparableSemver, parseComparableSemver } from "./semver-compare.js";

const DEFAULT_COREHUB_URL = "https://coreblow.com/corehub";
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export type CoreHubPackageFamily = "skill" | "code-plugin" | "bundle-plugin";
export type CoreHubPackageChannel = "official" | "community" | "private";
export type CoreHubPackageCompatibility = {
  pluginApiRange?: string;
  builtWithCoreBlowVersion?: string;
  minGatewayVersion?: string;
};

export type CoreHubPackageListItem = {
  name: string;
  displayName: string;
  family: CoreHubPackageFamily;
  runtimeId?: string | null;
  channel: CoreHubPackageChannel;
  isOfficial: boolean;
  summary?: string | null;
  ownerHandle?: string | null;
  createdAt: number;
  updatedAt: number;
  latestVersion?: string | null;
  capabilityTags?: string[];
  executesCode?: boolean;
  verificationTier?: string | null;
};

export type CoreHubPackageDetail = {
  package:
    | (CoreHubPackageListItem & {
        tags?: Record<string, string>;
        compatibility?: CoreHubPackageCompatibility | null;
        capabilities?: {
          executesCode?: boolean;
          runtimeId?: string;
          capabilityTags?: string[];
          bundleFormat?: string;
          hostTargets?: string[];
          pluginKind?: string;
          channels?: string[];
          providers?: string[];
          hooks?: string[];
          bundledSkills?: string[];
        } | null;
        verification?: {
          tier?: string;
          scope?: string;
          summary?: string;
          sourceRepo?: string;
          sourceCommit?: string;
          hasProvenance?: boolean;
          scanStatus?: string;
        } | null;
      })
    | null;
  owner?: {
    handle?: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
};

export type CoreHubPackageVersion = {
  package: {
    name: string;
    displayName: string;
    family: CoreHubPackageFamily;
  } | null;
  version: {
    version: string;
    createdAt: number;
    changelog: string;
    distTags?: string[];
    files?: unknown;
    compatibility?: CoreHubPackageCompatibility | null;
    capabilities?: CoreHubPackageDetail["package"] extends infer T
      ? T extends { capabilities?: infer C }
        ? C
        : never
      : never;
    verification?: CoreHubPackageDetail["package"] extends infer T
      ? T extends { verification?: infer C }
        ? C
        : never
      : never;
  } | null;
};

export type CoreHubPackageSearchResult = {
  score: number;
  package: CoreHubPackageListItem;
};

export type CoreHubSkillSearchResult = {
  score: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
};

export type CoreHubSkillDetail = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog?: string;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
  owner?: {
    handle?: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
};

export type CoreHubSkillListResponse = {
  items: Array<{
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    latestVersion?: {
      version: string;
      createdAt: number;
      changelog?: string;
    } | null;
    metadata?: {
      os?: string[] | null;
      systems?: string[] | null;
    } | null;
    createdAt: number;
    updatedAt: number;
  }>;
  nextCursor?: string | null;
};

export type CoreHubDownloadResult = {
  archivePath: string;
  integrity: string;
};

type CoreHubEnvelope<T> = {
  apiVersion?: string;
  data?: T;
  meta?: unknown;
};

type CoreHubCatalogEntry = {
  id?: string;
  kind?: string;
  name?: string;
  summary?: string;
  source?: string;
  homepage?: string;
  version?: string;
  tags?: string[];
  capabilities?: string[];
  publisher?: {
    handle?: string;
    displayName?: string;
    verified?: boolean;
  } | null;
  review?: {
    state?: string;
  } | null;
  coreblow?: {
    minCoreblowVersion?: string;
  } | null;
  versions?: CoreHubCatalogVersion[];
};

type CoreHubCatalogVersion = {
  version?: string;
  tag?: string;
  publishedAt?: string;
  status?: string;
  publisher?: {
    handle?: string;
  } | null;
  artifact?: {
    name?: string;
    mediaType?: string;
    size?: number;
    sha256?: string;
    storage?: {
      key?: string;
      url?: string;
    } | null;
  } | null;
};

type CoreHubDownloadMetadata = {
  package?: {
    id?: string;
    name?: string;
  } | null;
  version?: string | null;
  artifact?: CoreHubCatalogVersion["artifact"] | null;
  download?: {
    available?: boolean;
    url?: string;
  } | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type CoreHubRequestParams = {
  baseUrl?: string;
  path: string;
  token?: string;
  timeoutMs?: number;
  search?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
};

type CoreHubConfigLike = {
  token?: unknown;
  accessToken?: unknown;
  authToken?: unknown;
  apiToken?: unknown;
  auth?: CoreHubConfigLike | null;
  session?: CoreHubConfigLike | null;
  credentials?: CoreHubConfigLike | null;
  user?: CoreHubConfigLike | null;
};

export class CoreHubRequestError extends Error {
  readonly status: number;
  readonly requestPath: string;
  readonly responseBody: string;

  constructor(params: { path: string; status: number; body: string }) {
    super(`CoreHub ${params.path} failed (${params.status}): ${params.body}`);
    this.name = "CoreHubRequestError";
    this.status = params.status;
    this.requestPath = params.path;
    this.responseBody = params.body;
  }
}

function normalizeBaseUrl(baseUrl?: string): string {
  const envValue =
    process.env.COREBLOW_COREHUB_URL?.trim() ||
    process.env.COREHUB_URL?.trim() ||
    DEFAULT_COREHUB_URL;
  const value = (baseUrl?.trim() || envValue).replace(/\/+$/, "");
  return value || DEFAULT_COREHUB_URL;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractTokenFromCoreHubConfig(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as CoreHubConfigLike;
  return (
    readNonEmptyString(record.accessToken) ??
    readNonEmptyString(record.authToken) ??
    readNonEmptyString(record.apiToken) ??
    readNonEmptyString(record.token) ??
    extractTokenFromCoreHubConfig(record.auth) ??
    extractTokenFromCoreHubConfig(record.session) ??
    extractTokenFromCoreHubConfig(record.credentials) ??
    extractTokenFromCoreHubConfig(record.user)
  );
}

function resolveCoreHubConfigPaths(): string[] {
  const explicit =
    process.env.COREBLOW_COREHUB_CONFIG_PATH?.trim() ||
    process.env.COREHUB_CONFIG_PATH?.trim();
  if (explicit) {
    return [explicit];
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
  const configHome =
    xdgConfigHome && xdgConfigHome.length > 0 ? xdgConfigHome : path.join(os.homedir(), ".config");
  const xdgPath = path.join(configHome, "corehub", "config.json");

  if (process.platform === "darwin") {
    return [
      path.join(os.homedir(), "Library", "Application Support", "corehub", "config.json"),
      xdgPath,
    ];
  }

  return [xdgPath];
}

export async function resolveCoreHubAuthToken(): Promise<string | undefined> {
  const envToken =
    process.env.COREBLOW_COREHUB_TOKEN?.trim() ||
    process.env.COREHUB_TOKEN?.trim() ||
    process.env.COREHUB_AUTH_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  for (const configPath of resolveCoreHubConfigPaths()) {
    try {
      const raw = await fs.readFile(configPath, "utf8");
      const token = extractTokenFromCoreHubConfig(JSON.parse(raw));
      if (token) {
        return token;
      }
    } catch {
      // Try the next candidate path.
    }
  }
  return undefined;
}

function compareSemver(left: string, right: string): number | null {
  return compareComparableSemver(parseComparableSemver(left), parseComparableSemver(right));
}

function upperBoundForCaret(version: string): string | null {
  const parsed = parseComparableSemver(version);
  if (!parsed) {
    return null;
  }
  if (parsed.major > 0) {
    return `${parsed.major + 1}.0.0`;
  }
  if (parsed.minor > 0) {
    return `0.${parsed.minor + 1}.0`;
  }
  return `0.0.${parsed.patch + 1}`;
}

function satisfiesComparator(version: string, token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.startsWith("^")) {
    const base = trimmed.slice(1).trim();
    const upperBound = upperBoundForCaret(base);
    const lowerCmp = compareSemver(version, base);
    const upperCmp = upperBound ? compareSemver(version, upperBound) : null;
    return lowerCmp != null && upperCmp != null && lowerCmp >= 0 && upperCmp < 0;
  }

  const match = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(trimmed);
  if (!match) {
    return false;
  }
  const operator = match[1] ?? "=";
  const target = match[2]?.trim();
  if (!target) {
    return false;
  }
  const cmp = compareSemver(version, target);
  if (cmp == null) {
    return false;
  }
  switch (operator) {
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    case "=":
    default:
      return cmp === 0;
  }
}

function satisfiesSemverRange(version: string, range: string): boolean {
  const tokens = range
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }
  return tokens.every((token) => satisfiesComparator(version, token));
}

function buildUrl(params: Pick<CoreHubRequestParams, "baseUrl" | "path" | "search">): URL {
  const path = params.path.replace(/^\/+/, "");
  const url = new URL(path, `${normalizeBaseUrl(params.baseUrl)}/`);
  for (const [key, value] of Object.entries(params.search ?? {})) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }
  return url;
}

async function corehubRequest(
  params: CoreHubRequestParams,
): Promise<{ response: Response; url: URL }> {
  const url = buildUrl(params);
  const token = params.token?.trim() || (await resolveCoreHubAuthToken());
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(
          `CoreHub request timed out after ${params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS}ms`,
        ),
      ),
    params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );
  try {
    const response = await (params.fetchImpl ?? fetch)(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    return { response, url };
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    return text || response.statusText || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function fetchJson<T>(params: CoreHubRequestParams): Promise<T> {
  const { response, url } = await corehubRequest(params);
  if (!response.ok) {
    throw new CoreHubRequestError({
      path: url.pathname,
      status: response.status,
      body: await readErrorBody(response),
    });
  }
  return (await response.json()) as T;
}

async function fetchCoreHubData<T>(params: CoreHubRequestParams): Promise<T> {
  const payload = await fetchJson<T | CoreHubEnvelope<T>>(params);
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as CoreHubEnvelope<T>).data as T;
  }
  return payload as T;
}

export function resolveCoreHubBaseUrl(baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl);
}

export function formatSha256Integrity(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest("base64");
  return `sha256-${digest}`;
}

export function parseCoreHubPluginSpec(raw: string): {
  name: string;
  version?: string;
  baseUrl?: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("corehub:")) {
    return null;
  }
  const spec = trimmed.slice("corehub:".length).trim();
  if (!spec) {
    return null;
  }
  const atIndex = spec.lastIndexOf("@");
  if (atIndex <= 0 || atIndex >= spec.length - 1) {
    return { name: spec };
  }
  return {
    name: spec.slice(0, atIndex).trim(),
    version: spec.slice(atIndex + 1).trim() || undefined,
  };
}

export async function fetchCoreHubPackageDetail(params: {
  name: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<CoreHubPackageDetail> {
  const data = await fetchCoreHubData<CoreHubPackageDetail | CoreHubCatalogEntry>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  return normalizeCoreHubPackageDetail(data);
}

export async function fetchCoreHubPackageVersion(params: {
  name: string;
  version: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<CoreHubPackageVersion> {
  const versions = await fetchCoreHubData<CoreHubPackageVersion | CoreHubCatalogVersion[]>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/versions`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  if (!Array.isArray(versions)) {
    return versions;
  }
  const version =
    versions.find((candidate) => candidate.version === params.version || candidate.tag === params.version) ??
    null;
  if (!version) {
    throw new CoreHubRequestError({
      path: `/api/v1/packages/${params.name}/versions`,
      status: 404,
      body: `CoreHub package version not found: ${params.name}@${params.version}`,
    });
  }
  return normalizeCoreHubPackageVersion(params.name, version);
}

export async function searchCoreHubPackages(params: {
  query: string;
  family?: CoreHubPackageFamily;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<CoreHubPackageSearchResult[]> {
  const result = await fetchCoreHubData<
    { results?: CoreHubPackageSearchResult[] } | Array<CoreHubPackageSearchResult | CoreHubCatalogEntry>
  >({
    baseUrl: params.baseUrl,
    path: "/api/v1/packages/search",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      q: params.query.trim(),
      family: params.family,
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
  if (Array.isArray(result)) {
    return result.map((entry) => normalizeCoreHubPackageSearchResult(entry));
  }
  return result.results ?? [];
}

export async function searchCoreHubSkills(params: {
  query: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<CoreHubSkillSearchResult[]> {
  const result = await fetchCoreHubData<
    { results?: CoreHubSkillSearchResult[] } | Array<CoreHubSkillSearchResult | CoreHubCatalogEntry>
  >({
    baseUrl: params.baseUrl,
    path: "/api/v1/search",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      q: params.query.trim(),
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
  if (Array.isArray(result)) {
    return result.map((entry) => normalizeCoreHubSkillSearchResult(entry));
  }
  return result.results ?? [];
}

export async function fetchCoreHubSkillDetail(params: {
  slug: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<CoreHubSkillDetail> {
  return await fetchCoreHubData<CoreHubSkillDetail>({
    baseUrl: params.baseUrl,
    path: `/api/v1/skills/${encodeURIComponent(params.slug)}`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function listCoreHubSkills(params: {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<CoreHubSkillListResponse> {
  return await fetchCoreHubData<CoreHubSkillListResponse>({
    baseUrl: params.baseUrl,
    path: "/api/v1/skills",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
}

export async function downloadCoreHubPackageArchive(params: {
  name: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<CoreHubDownloadResult> {
  const search = params.version
    ? { version: params.version }
    : params.tag
      ? { tag: params.tag }
      : undefined;
  const metadata = await fetchCoreHubData<CoreHubDownloadMetadata>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/download`,
    search: {
      ...search,
      redirect: "false",
    },
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  const downloadUrl = metadata.download?.url?.trim();
  if (!metadata.download?.available || !downloadUrl) {
    throw new CoreHubRequestError({
      path: `/api/v1/packages/${params.name}/download`,
      status: 501,
      body: `CoreHub package download is not available: ${params.name}`,
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(
          `CoreHub download timed out after ${params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS}ms`,
        ),
      ),
    params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await (params.fetchImpl ?? fetch)(downloadUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new CoreHubRequestError({
      path: new URL(downloadUrl).pathname,
      status: response.status,
      body: await readErrorBody(response),
    });
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  validateCoreHubDownloadBytes(metadata, bytes);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-corehub-package-"));
  const archivePath = path.join(tmpDir, metadata.artifact?.name ?? `${params.name}.zip`);
  await fs.writeFile(archivePath, bytes);
  return {
    archivePath,
    integrity: formatSha256Integrity(bytes),
  };
}

export async function downloadCoreHubSkillArchive(params: {
  slug: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<CoreHubDownloadResult> {
  const { response, url } = await corehubRequest({
    baseUrl: params.baseUrl,
    path: "/api/v1/download",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      slug: params.slug,
      version: params.version,
      tag: params.version ? undefined : params.tag,
    },
  });
  if (!response.ok) {
    throw new CoreHubRequestError({
      path: url.pathname,
      status: response.status,
      body: await readErrorBody(response),
    });
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-corehub-skill-"));
  const archivePath = path.join(tmpDir, `${params.slug}.zip`);
  await fs.writeFile(archivePath, bytes);
  return {
    archivePath,
    integrity: formatSha256Integrity(bytes),
  };
}

export function resolveLatestVersionFromPackage(detail: CoreHubPackageDetail): string | null {
  return detail.package?.latestVersion ?? detail.package?.tags?.latest ?? null;
}

function normalizeCoreHubPackageDetail(
  input: CoreHubPackageDetail | CoreHubCatalogEntry,
): CoreHubPackageDetail {
  if ("package" in input) {
    return input as CoreHubPackageDetail;
  }
  const latest = input.versions?.find((version) => version.tag === "latest") ?? input.versions?.[0];
  const family = normalizeCoreHubFamily(input.kind);
  const channel = input.publisher?.verified ? "official" : "community";
  return {
    package: input.id
      ? {
          name: input.id,
          displayName: input.name ?? input.id,
          family,
          channel,
          isOfficial: channel === "official",
          summary: input.summary,
          ownerHandle: input.publisher?.handle ?? null,
          createdAt: 0,
          updatedAt: 0,
          latestVersion: latest?.version ?? input.version ?? null,
          capabilityTags: input.capabilities,
          executesCode: family !== "skill",
          compatibility: input.coreblow?.minCoreblowVersion
            ? { minGatewayVersion: input.coreblow.minCoreblowVersion }
            : null,
          verification: {
            tier: input.review?.state === "verified" ? "source-linked" : "structural",
            sourceRepo: input.source,
            scanStatus: input.review?.state,
          },
        }
      : null,
    owner: input.publisher
      ? {
          handle: input.publisher.handle ?? null,
          displayName: input.publisher.displayName ?? null,
        }
      : null,
  };
}

function normalizeCoreHubPackageVersion(
  packageName: string,
  input: CoreHubCatalogVersion,
): CoreHubPackageVersion {
  return {
    package: {
      name: packageName,
      displayName: packageName,
      family: "code-plugin",
    },
    version: input.version
      ? {
          version: input.version,
          createdAt: Date.parse(input.publishedAt ?? "") || 0,
          changelog: "",
          distTags: input.tag ? [input.tag] : [],
        }
      : null,
  };
}

function normalizeCoreHubPackageSearchResult(
  input: CoreHubPackageSearchResult | CoreHubCatalogEntry,
): CoreHubPackageSearchResult {
  if ("package" in input) {
    return input as CoreHubPackageSearchResult;
  }
  return {
    score: Number((input as { score?: unknown }).score ?? 0),
    package: normalizeCoreHubPackageDetail(input).package!,
  };
}

function normalizeCoreHubSkillSearchResult(
  input: CoreHubSkillSearchResult | CoreHubCatalogEntry,
): CoreHubSkillSearchResult {
  if ("slug" in input) {
    return input as CoreHubSkillSearchResult;
  }
  return {
    score: Number((input as { score?: unknown }).score ?? 0),
    slug: input.id ?? "",
    displayName: input.name ?? input.id ?? "",
    summary: input.summary,
    version: input.version,
    updatedAt: 0,
  };
}

function normalizeCoreHubFamily(kind?: string): CoreHubPackageFamily {
  return kind === "skill" ? "skill" : "code-plugin";
}

function validateCoreHubDownloadBytes(metadata: CoreHubDownloadMetadata, bytes: Uint8Array): void {
  const expectedSize = metadata.artifact?.size;
  if (Number.isInteger(expectedSize) && bytes.byteLength !== expectedSize) {
    throw new Error(
      `CoreHub artifact size mismatch: expected ${expectedSize}, received ${bytes.byteLength}`,
    );
  }
  if (metadata.artifact?.sha256) {
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== metadata.artifact.sha256) {
      throw new Error(
        `CoreHub artifact checksum mismatch: expected ${metadata.artifact.sha256}, received ${digest}`,
      );
    }
  }
}

export function isCoreHubFamilySkill(detail: CoreHubPackageDetail | CoreHubSkillDetail): boolean {
  if ("package" in detail) {
    return detail.package?.family === "skill";
  }
  return Boolean(detail.skill);
}

export function satisfiesPluginApiRange(
  pluginApiVersion: string,
  pluginApiRange?: string | null,
): boolean {
  if (!pluginApiRange) {
    return true;
  }
  return satisfiesSemverRange(pluginApiVersion, pluginApiRange);
}

export function satisfiesGatewayMinimum(
  currentVersion: string,
  minGatewayVersion?: string | null,
): boolean {
  if (!minGatewayVersion) {
    return true;
  }
  const current = parseSemver(currentVersion);
  const minimum = parseSemver(minGatewayVersion);
  if (!current || !minimum) {
    return false;
  }
  return isAtLeast(current, minimum);
}

// ---------------------------------------------------------------------------
// CorehubService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class CorehubService {
  [Symbol.toStringTag] = 'CorehubService';
}


const { getInstance: getCorehubService, __testing: __testing_corehub } =
  createStandaloneSingleton({ create: () => new CorehubService(), defaultDeps: {} });

export { getCorehubService, __testing_corehub };
