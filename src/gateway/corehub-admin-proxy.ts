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
const COREHUB_PROXY_MAX_BODY_BYTES = 64 * 1024;

function isAllowedCoreHubProxyMethod(method: string, pathname: string): boolean {
  if (method === "GET" || method === "HEAD") {
    return true;
  }
  return method === "POST" && COREHUB_REVIEW_ACTION_RE.test(pathname);
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

  let body: string | undefined;
  if (method === "POST") {
    const bodyUnknown = await readJsonBodyOrError(req, res, COREHUB_PROXY_MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    headers["content-type"] = "application/json";
    body = JSON.stringify(bodyUnknown ?? {});
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
