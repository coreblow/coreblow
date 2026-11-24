import crypto from "node:crypto";
import path from "node:path";
import {
  listCombinedAccountIds,
  resolveListedDefaultAccountId,
} from "../channels/plugins/account-helpers.js";
import type { CoreBlowConfig } from "../config/config.js";
import { hasConfiguredSecretInput } from "../config/types.secrets.js";
import { listConfiguredAccountIds } from "../plugin-sdk/account-configured-ids.js";
import { resolveNormalizedAccountEntry } from "../routing/account-lookup.js";
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// ─── Storage Paths ───────────────────────────────────────────────────────────

function sanitizeMatrixPathSegment(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "unknown";
}

function resolveMatrixHomeserverKey(homeserver: string): string {
  try {
    const url = new URL(homeserver);
    if (url.host) {
      return sanitizeMatrixPathSegment(url.host);
    }
  } catch {
    // fall through
  }
  return sanitizeMatrixPathSegment(homeserver);
}

function hashMatrixAccessToken(accessToken: string): string {
  return crypto.createHash("sha256").update(accessToken).digest("hex").slice(0, 16);
}

function resolveMatrixCredentialsFilename(accountId?: string | null): string {
  const normalized = normalizeAccountId(accountId);
  return normalized === DEFAULT_ACCOUNT_ID ? "credentials.json" : `credentials-${normalized}.json`;
}

export function resolveMatrixCredentialsDir(stateDir: string): string {
  return path.join(stateDir, "credentials", "matrix");
}

export function resolveMatrixCredentialsPath(params: {
  stateDir: string;
  accountId?: string | null;
}): string {
  return path.join(
    resolveMatrixCredentialsDir(params.stateDir),
    resolveMatrixCredentialsFilename(params.accountId),
  );
}

export function resolveMatrixLegacyFlatStoragePaths(stateDir: string): {
  rootDir: string;
  storagePath: string;
  cryptoPath: string;
} {
  const rootDir = path.join(stateDir, "matrix");
  return {
    rootDir,
    storagePath: path.join(rootDir, "bot-storage.json"),
    cryptoPath: path.join(rootDir, "crypto"),
  };
}

export function resolveMatrixAccountStorageRoot(params: {
  stateDir: string;
  homeserver: string;
  userId: string;
  accessToken: string;
  accountId?: string | null;
}): {
  rootDir: string;
  accountKey: string;
  tokenHash: string;
} {
  const accountKey = sanitizeMatrixPathSegment(params.accountId ?? DEFAULT_ACCOUNT_ID);
  const userKey = sanitizeMatrixPathSegment(params.userId);
  const serverKey = resolveMatrixHomeserverKey(params.homeserver);
  const tokenHash = hashMatrixAccessToken(params.accessToken);
  return {
    rootDir: path.join(
      params.stateDir,
      "matrix",
      "accounts",
      accountKey,
      `${serverKey}__${userKey}`,
      tokenHash,
    ),
    accountKey,
    tokenHash,
  };
}

// ─── Env Vars ────────────────────────────────────────────────────────────────

const MATRIX_SCOPED_ENV_SUFFIXES = [
  "HOMESERVER",
  "USER_ID",
  "ACCESS_TOKEN",
  "PASSWORD",
  "DEVICE_ID",
  "DEVICE_NAME",
] as const;
const MATRIX_GLOBAL_ENV_KEYS = MATRIX_SCOPED_ENV_SUFFIXES.map((suffix) => `MATRIX_${suffix}`);
const MATRIX_SCOPED_ENV_RE = new RegExp(`^MATRIX_(.+)_(${MATRIX_SCOPED_ENV_SUFFIXES.join("|")})$`);

function resolveMatrixEnvAccountToken(accountId: string): string {
  return Array.from(normalizeAccountId(accountId))
    .map((char) =>
      /[a-z0-9]/.test(char)
        ? char.toUpperCase()
        : `_X${char.codePointAt(0)?.toString(16).toUpperCase() ?? "00"}_`,
    )
    .join("");
}

export function getMatrixScopedEnvVarNames(accountId: string): {
  homeserver: string;
  userId: string;
  accessToken: string;
  password: string;
  deviceId: string;
  deviceName: string;
} {
  const token = resolveMatrixEnvAccountToken(accountId);
  return {
    homeserver: `MATRIX_${token}_HOMESERVER`,
    userId: `MATRIX_${token}_USER_ID`,
    accessToken: `MATRIX_${token}_ACCESS_TOKEN`,
    password: `MATRIX_${token}_PASSWORD`, // pragma: allowlist secret
    deviceId: `MATRIX_${token}_DEVICE_ID`,
    deviceName: `MATRIX_${token}_DEVICE_NAME`,
  };
}

function decodeMatrixEnvAccountToken(token: string): string | undefined {
  let decoded = "";
  for (let index = 0; index < token.length; ) {
    const hexEscape = /^_X([0-9A-F]+)_/.exec(token.slice(index));
    if (hexEscape) {
      const hex = hexEscape[1];
      const codePoint = hex ? Number.parseInt(hex, 16) : Number.NaN;
      if (!Number.isFinite(codePoint)) {
        return undefined;
      }
      decoded += String.fromCodePoint(codePoint);
      index += hexEscape[0].length;
      continue;
    }
    const char = token[index];
    if (!char || !/[A-Z0-9]/.test(char)) {
      return undefined;
    }
    decoded += char.toLowerCase();
    index += 1;
  }
  const normalized = normalizeOptionalAccountId(decoded);
  if (!normalized) {
    return undefined;
  }
  return resolveMatrixEnvAccountToken(normalized) === token ? normalized : undefined;
}

function listMatrixEnvAccountIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const ids = new Set<string>();
  for (const key of MATRIX_GLOBAL_ENV_KEYS) {
    if (typeof env[key] === "string" && env[key]?.trim()) {
      ids.add(normalizeAccountId("default"));
      break;
    }
  }
  for (const key of Object.keys(env)) {
    const match = MATRIX_SCOPED_ENV_RE.exec(key);
    if (!match) {
      continue;
    }
    const accountId = decodeMatrixEnvAccountToken(match[1]);
    if (accountId) {
      ids.add(accountId);
    }
  }
  return Array.from(ids).toSorted((a, b) => a.localeCompare(b));
}

// ─── Auth Precedence ─────────────────────────────────────────────────────────

export type MatrixResolvedStringField =
  | "homeserver"
  | "userId"
  | "accessToken"
  | "password"
  | "deviceId"
  | "deviceName";

export type MatrixResolvedStringValues = Record<MatrixResolvedStringField, string>;

type MatrixStringSourceMap = Partial<Record<MatrixResolvedStringField, string>>;

const MATRIX_DEFAULT_ACCOUNT_AUTH_ONLY_FIELDS = new Set<MatrixResolvedStringField>([
  "userId",
  "accessToken",
  "password",
  "deviceId",
]);

function resolveMatrixStringSourceValue(value: string | undefined): string {
  return typeof value === "string" ? value : "";
}

function shouldAllowBaseAuthFallback(accountId: string, field: MatrixResolvedStringField): boolean {
  return (
    normalizeAccountId(accountId) === DEFAULT_ACCOUNT_ID ||
    !MATRIX_DEFAULT_ACCOUNT_AUTH_ONLY_FIELDS.has(field)
  );
}

export function resolveMatrixAccountStringValues(params: {
  accountId: string;
  account?: MatrixStringSourceMap;
  scopedEnv?: MatrixStringSourceMap;
  channel?: MatrixStringSourceMap;
  globalEnv?: MatrixStringSourceMap;
}): MatrixResolvedStringValues {
  const fields: MatrixResolvedStringField[] = [
    "homeserver",
    "userId",
    "accessToken",
    "password",
    "deviceId",
    "deviceName",
  ];
  const resolved = {} as MatrixResolvedStringValues;

  for (const field of fields) {
    resolved[field] =
      resolveMatrixStringSourceValue(params.account?.[field]) ||
      resolveMatrixStringSourceValue(params.scopedEnv?.[field]) ||
      (shouldAllowBaseAuthFallback(params.accountId, field)
        ? resolveMatrixStringSourceValue(params.channel?.[field]) ||
          resolveMatrixStringSourceValue(params.globalEnv?.[field])
        : "");
  }

  return resolved;
}

// ─── Account Selection ───────────────────────────────────────────────────────

type MatrixTopologyStringSources = Partial<Record<MatrixResolvedStringField, string>>;

function readConfiguredMatrixString(value: unknown): string {
  return normalizeOptionalString(value) ?? "";
}

function readConfiguredMatrixSecretSource(value: unknown): string {
  return hasConfiguredSecretInput(value) ? "configured" : "";
}

function resolveMatrixChannelStringSources(
  entry: Record<string, unknown> | null,
): MatrixTopologyStringSources {
  if (!entry) {
    return {};
  }
  return {
    homeserver: readConfiguredMatrixString(entry.homeserver),
    userId: readConfiguredMatrixString(entry.userId),
    accessToken: readConfiguredMatrixSecretSource(entry.accessToken),
    password: readConfiguredMatrixSecretSource(entry.password),
    deviceId: readConfiguredMatrixString(entry.deviceId),
    deviceName: readConfiguredMatrixString(entry.deviceName),
  };
}

function readEnvMatrixString(env: NodeJS.ProcessEnv, key: string): string {
  return normalizeOptionalString(env[key]) ?? "";
}

function resolveScopedMatrixEnvStringSources(
  accountId: string,
  env: NodeJS.ProcessEnv,
): MatrixTopologyStringSources {
  const keys = getMatrixScopedEnvVarNames(accountId);
  return {
    homeserver: readEnvMatrixString(env, keys.homeserver),
    userId: readEnvMatrixString(env, keys.userId),
    accessToken: readEnvMatrixString(env, keys.accessToken),
    password: readEnvMatrixString(env, keys.password),
    deviceId: readEnvMatrixString(env, keys.deviceId),
    deviceName: readEnvMatrixString(env, keys.deviceName),
  };
}

function resolveGlobalMatrixEnvStringSources(env: NodeJS.ProcessEnv): MatrixTopologyStringSources {
  return {
    homeserver: readEnvMatrixString(env, "MATRIX_HOMESERVER"),
    userId: readEnvMatrixString(env, "MATRIX_USER_ID"),
    accessToken: readEnvMatrixString(env, "MATRIX_ACCESS_TOKEN"),
    password: readEnvMatrixString(env, "MATRIX_PASSWORD"),
    deviceId: readEnvMatrixString(env, "MATRIX_DEVICE_ID"),
    deviceName: readEnvMatrixString(env, "MATRIX_DEVICE_NAME"),
  };
}

function resolveEffectiveMatrixAccountSources(params: {
  channel: Record<string, unknown> | null;
  accountId: string;
  env: NodeJS.ProcessEnv;
}): MatrixResolvedStringValues {
  const normalizedAccountId = normalizeAccountId(params.accountId);
  return resolveMatrixAccountStringValues({
    accountId: normalizedAccountId,
    scopedEnv: resolveScopedMatrixEnvStringSources(normalizedAccountId, params.env),
    channel: resolveMatrixChannelStringSources(params.channel),
    globalEnv: resolveGlobalMatrixEnvStringSources(params.env),
  });
}

function hasUsableEffectiveMatrixAccountSource(params: {
  channel: Record<string, unknown> | null;
  accountId: string;
  env: NodeJS.ProcessEnv;
}): boolean {
  const values = resolveEffectiveMatrixAccountSources(params);
  return Boolean(values.homeserver && (values.accessToken || values.userId));
}

function hasConfiguredDefaultMatrixAccountSource(params: {
  channel: Record<string, unknown> | null;
  env: NodeJS.ProcessEnv;
}): boolean {
  const values = resolveEffectiveMatrixAccountSources({
    channel: params.channel,
    accountId: DEFAULT_ACCOUNT_ID,
    env: params.env,
  });
  return Boolean(values.homeserver && (values.accessToken || (values.userId && values.password)));
}

export function resolveMatrixChannelConfig(cfg: CoreBlowConfig): Record<string, unknown> | null {
  return isRecord(cfg.channels?.matrix) ? cfg.channels.matrix : null;
}

export function findMatrixAccountEntry(
  cfg: CoreBlowConfig,
  accountId: string,
): Record<string, unknown> | null {
  const channel = resolveMatrixChannelConfig(cfg);
  if (!channel) {
    return null;
  }

  const accounts = isRecord(channel.accounts) ? channel.accounts : null;
  if (!accounts) {
    return null;
  }
  const entry = resolveNormalizedAccountEntry(accounts, accountId, normalizeAccountId);
  return isRecord(entry) ? entry : null;
}

export function resolveConfiguredMatrixAccountIds(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const channel = resolveMatrixChannelConfig(cfg);
  const configuredAccountIds = listConfiguredAccountIds({
    accounts: channel && isRecord(channel.accounts) ? channel.accounts : undefined,
    normalizeAccountId,
  });
  if (hasConfiguredDefaultMatrixAccountSource({ channel, env })) {
    configuredAccountIds.push(DEFAULT_ACCOUNT_ID);
  }
  const readyEnvAccountIds = listMatrixEnvAccountIds(env).filter((accountId) =>
    normalizeAccountId(accountId) === DEFAULT_ACCOUNT_ID
      ? hasConfiguredDefaultMatrixAccountSource({ channel, env })
      : hasUsableEffectiveMatrixAccountSource({ channel, accountId, env }),
  );
  return listCombinedAccountIds({
    configuredAccountIds,
    additionalAccountIds: readyEnvAccountIds,
    fallbackAccountIdWhenEmpty: channel ? DEFAULT_ACCOUNT_ID : undefined,
  });
}

export function resolveMatrixDefaultOrOnlyAccountId(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const channel = resolveMatrixChannelConfig(cfg);
  if (!channel) {
    return DEFAULT_ACCOUNT_ID;
  }

  const configuredDefault = normalizeOptionalAccountId(
    typeof channel.defaultAccount === "string" ? channel.defaultAccount : undefined,
  );
  const configuredAccountIds = resolveConfiguredMatrixAccountIds(cfg, env);
  return resolveListedDefaultAccountId({
    accountIds: configuredAccountIds,
    configuredDefaultAccountId: configuredDefault,
    ambiguousFallbackAccountId: DEFAULT_ACCOUNT_ID,
  });
}

export function requiresExplicitMatrixDefaultAccount(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const channel = resolveMatrixChannelConfig(cfg);
  if (!channel) {
    return false;
  }
  const configuredAccountIds = resolveConfiguredMatrixAccountIds(cfg, env);
  if (configuredAccountIds.length <= 1) {
    return false;
  }
  if (configuredAccountIds.includes(DEFAULT_ACCOUNT_ID)) {
    return false;
  }
  const configuredDefault = normalizeOptionalAccountId(
    typeof channel.defaultAccount === "string" ? channel.defaultAccount : undefined,
  );
  return !(configuredDefault && configuredAccountIds.includes(configuredDefault));
}
