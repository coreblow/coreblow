import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../config/config.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { authorizeGatewayBearerRequestOrReply } from "./http-auth-helpers.js";
import {
  readJsonBodyOrError,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
} from "./http-common.js";
import { getHeader } from "./http-utils.js";

export const DEFAULT_COREHUB_REGISTRY_URL = "https://coreblow.com/corehub";

const COREHUB_PROXY_PREFIX = "/api/corehub/";
const COREHUB_API_PATH_RE = /^\/api\/corehub\/(?<version>v[0-9]+)(?<path>\/.*)?$/;
const COREHUB_REVIEW_ACTION_RE =
  /^\/api\/corehub\/v2\/reviews\/[^/]+\/(?:approve|block|assign|evidence)$/;
const COREHUB_ARTIFACT_UPLOAD_RE = /^\/api\/corehub\/v2\/artifacts\/uploads\/[^/]+$/;
const COREHUB_ARTIFACT_VERIFY_RE = /^\/api\/corehub\/v2\/artifacts\/uploads\/[^/]+\/verify$/;
const COREHUB_TRANSFER_DECISION_RE =
  /^\/api\/corehub\/v2\/transfers\/[^/]+\/(?:accept|reject|cancel)$/;
const COREHUB_AUDIT_RETENTION_PRUNE_RE = /^\/api\/corehub\/v2\/audit\/retention\/prune$/;
const COREHUB_PUBLISHER_CLAIM_RE = /^\/api\/corehub\/v2\/publishers\/claim$/;
const COREHUB_PUBLISHER_VERIFY_RE = /^\/api\/corehub\/v2\/publishers\/[^/]+\/verify$/;
const COREHUB_PROXY_MAX_BODY_BYTES = 64 * 1024;
const COREHUB_PROXY_MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;

function isAllowedCoreHubProxyMethod(method: string, pathname: string): boolean {
  if (method === "GET" || method === "HEAD") {
    return true;
  }
  if (method === "PUT") {
    return COREHUB_ARTIFACT_UPLOAD_RE.test(pathname);
  }
  return (
    method === "POST" &&
    (COREHUB_REVIEW_ACTION_RE.test(pathname) ||
      pathname === "/api/corehub/v2/artifacts/uploads" ||
      pathname === "/api/corehub/v2/submissions" ||
      pathname === "/api/corehub/v2/transfers" ||
      COREHUB_ARTIFACT_VERIFY_RE.test(pathname) ||
      COREHUB_TRANSFER_DECISION_RE.test(pathname) ||
      COREHUB_AUDIT_RETENTION_PRUNE_RE.test(pathname) ||
      COREHUB_PUBLISHER_CLAIM_RE.test(pathname) ||
      COREHUB_PUBLISHER_VERIFY_RE.test(pathname))
  );
}

export function normalizeCoreHubRegistryUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() || DEFAULT_COREHUB_REGISTRY_URL;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveCoreHubUpstreamUrl(params: {
  requestUrl: string;
  registryUrl?: string;
  host?: string;
}): string | null {
  const url = new URL(params.requestUrl, `http://${params.host ?? "localhost"}`);
  const match = COREHUB_API_PATH_RE.exec(url.pathname);
  const version = match?.groups?.version;
  if (!version) {
    return null;
  }
  const path = match.groups?.path ?? "";
  const registry = normalizeCoreHubRegistryUrl(params.registryUrl);
  if (!registry) {
    return null;
  }
  return `${registry}/api/${version}${path}${url.search}`;
}

export async function handleCoreHubAdminProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
    fetchImpl?: typeof fetch;
  },
): Promise<boolean> {
  const requestUrl = req.url ?? "/";
  const url = new URL(requestUrl, `http://${req.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith(COREHUB_PROXY_PREFIX)) {
    return false;
  }

  const method = (req.method ?? "GET").toUpperCase();
  if (!isAllowedCoreHubProxyMethod(method, url.pathname)) {
    sendMethodNotAllowed(res, "GET, HEAD, POST");
    return true;
  }

  if (url.searchParams.has("token")) {
    sendInvalidRequest(res, "CoreHub tokens must be sent in headers, not query parameters.");
    return true;
  }

  const cfg = loadConfig();
  const ok = await authorizeGatewayBearerRequestOrReply({
    req,
    res,
    auth: opts.auth,
    trustedProxies: opts.trustedProxies ?? cfg.gateway?.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
  });
  if (!ok) {
    return true;
  }

  const upstreamUrl = resolveCoreHubUpstreamUrl({
    requestUrl,
    host: req.headers.host,
    registryUrl: getHeader(req, "x-corehub-registry-url"),
  });
  if (!upstreamUrl) {
    sendInvalidRequest(res, "Invalid CoreHub proxy path or registry URL.");
    return true;
  }

  const coreHubToken = getHeader(req, "x-corehub-token")?.trim();
  const coreHubActor = getHeader(req, "x-corehub-user")?.trim();
  const headers: Record<string, string> = {
    accept: getHeader(req, "accept") ?? "application/json",
  };
  if (coreHubActor) {
    headers["x-corehub-user"] = coreHubActor;
  }
  if (coreHubToken) {
    headers.authorization = `Bearer ${coreHubToken}`;
    headers["x-corehub-token"] = coreHubToken;
  }

  let body: BodyInit | undefined;
  if (method === "POST") {
    const bodyUnknown = await readJsonBodyOrError(req, res, COREHUB_PROXY_MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    headers["content-type"] = "application/json";
    body = JSON.stringify(bodyUnknown ?? {});
  } else if (method === "PUT") {
    const contentType = getHeader(req, "content-type");
    const artifactSha256 = getHeader(req, "x-corehub-artifact-sha256");
    const artifactSize = getHeader(req, "x-corehub-artifact-size");
    if (contentType) {
      headers["content-type"] = contentType;
    }
    if (artifactSha256) {
      headers["x-corehub-artifact-sha256"] = artifactSha256;
    }
    if (artifactSize) {
      headers["x-corehub-artifact-size"] = artifactSize;
    }
    const bytes = await readBinaryBodyOrError(req, res, COREHUB_PROXY_MAX_ARTIFACT_BYTES);
    if (!bytes) {
      return true;
    }
    body = Uint8Array.from(bytes).buffer;
  }

  try {
    const init: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      init.body = body;
    }
    const upstream = await (opts.fetchImpl ?? fetch)(upstreamUrl, init);
    res.statusCode = upstream.status;
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) {
      res.setHeader("Cache-Control", cacheControl);
    }
    if (method === "HEAD") {
      res.end();
      return true;
    }
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.end(responseBody);
    return true;
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: {
        type: "corehub_proxy_error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return true;
  }
}

async function readBinaryBodyOrError(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      sendJson(res, 413, {
        error: { message: "Payload too large", type: "invalid_request_error" },
      });
      return undefined;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
