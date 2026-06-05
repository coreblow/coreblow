import { randomUUID } from "node:crypto";
import {
  resolveDebugProxyBlobDir,
  resolveDebugProxyCertDir,
  resolveDebugProxyDbPath,
} from "./paths.js";

export const COREBLOW_DEBUG_PROXY_ENABLED = "COREBLOW_DEBUG_PROXY_ENABLED";
export const COREBLOW_DEBUG_PROXY_URL = "COREBLOW_DEBUG_PROXY_URL";
export const COREBLOW_DEBUG_PROXY_DB_PATH = "COREBLOW_DEBUG_PROXY_DB_PATH";
export const COREBLOW_DEBUG_PROXY_BLOB_DIR = "COREBLOW_DEBUG_PROXY_BLOB_DIR";
export const COREBLOW_DEBUG_PROXY_CERT_DIR = "COREBLOW_DEBUG_PROXY_CERT_DIR";
export const COREBLOW_DEBUG_PROXY_SESSION_ID = "COREBLOW_DEBUG_PROXY_SESSION_ID";
export const COREBLOW_DEBUG_PROXY_REQUIRE = "COREBLOW_DEBUG_PROXY_REQUIRE";

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

export type DebugProxyEnvConfig = {
  enabled: boolean;
  required: boolean;
  proxyUrl?: string;
  dbPath: string;
  blobDir: string;
  certDir: string;
  sessionId: string;
  sourceProcess: "coreblow";
};

export function resolveDebugProxyEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
): DebugProxyEnvConfig {
  const enabled = isTruthy(env[COREBLOW_DEBUG_PROXY_ENABLED]);
  const explicitSessionId = env[COREBLOW_DEBUG_PROXY_SESSION_ID]?.trim() || undefined;
  return {
    enabled,
    required: isTruthy(env[COREBLOW_DEBUG_PROXY_REQUIRE]),
    proxyUrl: env[COREBLOW_DEBUG_PROXY_URL]?.trim() || undefined,
    dbPath: env[COREBLOW_DEBUG_PROXY_DB_PATH]?.trim() || resolveDebugProxyDbPath(env),
    blobDir: env[COREBLOW_DEBUG_PROXY_BLOB_DIR]?.trim() || resolveDebugProxyBlobDir(env),
    certDir: env[COREBLOW_DEBUG_PROXY_CERT_DIR]?.trim() || resolveDebugProxyCertDir(env),
    sessionId: explicitSessionId ?? randomUUID(),
    sourceProcess: "coreblow",
  };
}

export function buildDebugProxyChildEnv(params: {
  proxyUrl: string;
  sessionId: string;
  env?: NodeJS.ProcessEnv;
  dbPath?: string;
  blobDir?: string;
  certDir?: string;
}): NodeJS.ProcessEnv {
  const env = params.env ?? process.env;
  return {
    ...env,
    [COREBLOW_DEBUG_PROXY_ENABLED]: "1",
    [COREBLOW_DEBUG_PROXY_REQUIRE]: "1",
    [COREBLOW_DEBUG_PROXY_URL]: params.proxyUrl,
    [COREBLOW_DEBUG_PROXY_DB_PATH]: params.dbPath ?? resolveDebugProxyDbPath(env),
    [COREBLOW_DEBUG_PROXY_BLOB_DIR]: params.blobDir ?? resolveDebugProxyBlobDir(env),
    [COREBLOW_DEBUG_PROXY_CERT_DIR]: params.certDir ?? resolveDebugProxyCertDir(env),
    [COREBLOW_DEBUG_PROXY_SESSION_ID]: params.sessionId,
  };
}
