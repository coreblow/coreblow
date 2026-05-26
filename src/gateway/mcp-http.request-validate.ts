import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";
import { isTruthyEnvValue } from "../infra/env.js";
import { safeEqualSecret } from "../security/secret-equal.js";

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return undefined;
}

function shouldLogMcpLoopbackHttp(): boolean {
  return (
    isTruthyEnvValue(process.env.COREBLOW_CLI_BACKEND_LOG_OUTPUT) ||
    isTruthyEnvValue(process.env.COREBLOW_LIVE_CLI_BACKEND_DEBUG)
  );
}

function logMcpLoopbackHttp(step: string, details: Record<string, unknown>): void {
  if (!shouldLogMcpLoopbackHttp()) {
    return;
  }
  console.error(`[mcp-loopback] ${step} ${JSON.stringify(details)}`);
}

function isLoopbackAddress(value: string | undefined): boolean {
  const input = value?.trim();
  if (!input) {
    return false;
  }
  if (input === "::1" || input === "127.0.0.1") {
    return true;
  }
  if (input.startsWith("127.")) {
    return true;
  }
  if (input.toLowerCase().startsWith("::ffff:127.")) {
    return true;
  }
  return net.isIP(input) !== 0 && input === "0:0:0:0:0:0:0:1";
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "localhost") {
    return true;
  }
  return isLoopbackAddress(normalized);
}

function rejectsBrowserLoopbackRequest(req: IncomingMessage): boolean {
  const origin = getHeader(req, "origin");
  if (!origin) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return true;
  }
  return !(isLoopbackAddress(req.socket?.remoteAddress) && isLoopbackHost(parsed.hostname));
}

export function validateMcpLoopbackRequest(params: {
  req: IncomingMessage;
  res: ServerResponse;
  ownerToken: string;
  nonOwnerToken: string;
}): { senderIsOwner: boolean } | null {
  let url: URL;
  try {
    url = new URL(params.req.url ?? "/", `http://${params.req.headers.host ?? "localhost"}`);
  } catch {
    logMcpLoopbackHttp("reject", { reason: "bad_request_url", method: params.req.method ?? "" });
    params.res.writeHead(400, { "Content-Type": "application/json" });
    params.res.end(JSON.stringify({ error: "bad_request" }));
    return null;
  }

  if (params.req.method === "GET" && url.pathname.startsWith("/.well-known/")) {
    params.res.writeHead(404);
    params.res.end();
    return null;
  }

  if (url.pathname !== "/mcp") {
    logMcpLoopbackHttp("reject", {
      reason: "not_found",
      method: params.req.method ?? "",
      path: url.pathname,
    });
    params.res.writeHead(404, { "Content-Type": "application/json" });
    params.res.end(JSON.stringify({ error: "not_found" }));
    return null;
  }

  if (params.req.method !== "POST") {
    logMcpLoopbackHttp("reject", {
      reason: "method_not_allowed",
      method: params.req.method ?? "",
      path: url.pathname,
    });
    params.res.writeHead(405, { Allow: "POST" });
    params.res.end();
    return null;
  }

  if (rejectsBrowserLoopbackRequest(params.req)) {
    logMcpLoopbackHttp("reject", {
      reason: "forbidden_origin",
      method: params.req.method ?? "",
      origin: getHeader(params.req, "origin") ?? "",
    });
    params.res.writeHead(403, { "Content-Type": "application/json" });
    params.res.end(JSON.stringify({ error: "forbidden" }));
    return null;
  }

  const authHeader = getHeader(params.req, "authorization") ?? "";
  const ownerTokenMatched = safeEqualSecret(authHeader, `Bearer ${params.ownerToken}`);
  const nonOwnerTokenMatched = safeEqualSecret(authHeader, `Bearer ${params.nonOwnerToken}`);
  const senderIsOwner = ownerTokenMatched ? true : nonOwnerTokenMatched ? false : null;
  if (senderIsOwner === null) {
    logMcpLoopbackHttp("reject", {
      reason: "unauthorized",
      method: params.req.method ?? "",
      hasAuthorization: authHeader.length > 0,
    });
    params.res.writeHead(401, { "Content-Type": "application/json" });
    params.res.end(JSON.stringify({ error: "unauthorized" }));
    return null;
  }

  const contentType = getHeader(params.req, "content-type") ?? "";
  if (!contentType.startsWith("application/json")) {
    logMcpLoopbackHttp("reject", {
      reason: "unsupported_media_type",
      method: params.req.method ?? "",
      contentType,
    });
    params.res.writeHead(415, { "Content-Type": "application/json" });
    params.res.end(JSON.stringify({ error: "unsupported_media_type" }));
    return null;
  }

  return { senderIsOwner };
}
