import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  readMcpHttpBody,
  resolveMcpRequestContext,
  validateMcpLoopbackRequest,
} from "./mcp-http.request.js";

function createReq(params: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  remoteAddress?: string;
}): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = params.method ?? "POST";
  req.url = params.url ?? "/mcp";
  req.headers = {
    host: "127.0.0.1:3000",
    "content-type": "application/json",
    ...params.headers,
  };
  req.socket = { remoteAddress: params.remoteAddress ?? "127.0.0.1" } as IncomingMessage["socket"];
  req.destroy = vi.fn() as IncomingMessage["destroy"];
  return req;
}

function createRes(): ServerResponse & {
  statusCodeWritten?: number;
  headersWritten?: Record<string, string>;
  body?: string;
} {
  const res = {
    writeHead: vi.fn((statusCode: number, headers?: Record<string, string>) => {
      res.statusCodeWritten = statusCode;
      res.headersWritten = headers;
      return res;
    }),
    end: vi.fn((body?: string) => {
      res.body = body;
      return res;
    }),
  } as unknown as ServerResponse & {
    statusCodeWritten?: number;
    headersWritten?: Record<string, string>;
    body?: string;
  };
  return res;
}

function validate(params: {
  req?: IncomingMessage;
  ownerToken?: string;
  nonOwnerToken?: string;
}) {
  const res = createRes();
  const result = validateMcpLoopbackRequest({
    req: params.req ?? createReq({ headers: { authorization: "Bearer owner-token" } }),
    res,
    ownerToken: params.ownerToken ?? "owner-token",
    nonOwnerToken: params.nonOwnerToken ?? "non-owner-token",
  });
  return { result, res };
}

describe("MCP loopback request validation", () => {
  it("accepts owner and non-owner bearer tokens", () => {
    expect(
      validate({ req: createReq({ headers: { authorization: "Bearer owner-token" } }) }).result,
    ).toEqual({ senderIsOwner: true });
    expect(
      validate({ req: createReq({ headers: { authorization: "Bearer non-owner-token" } }) }).result,
    ).toEqual({ senderIsOwner: false });
  });

  it("rejects unsupported paths, methods, auth, and content types", () => {
    const notFound = validate({ req: createReq({ url: "/other" }) });
    expect(notFound.result).toBeNull();
    expect(notFound.res.statusCodeWritten).toBe(404);

    const method = validate({ req: createReq({ method: "GET" }) });
    expect(method.result).toBeNull();
    expect(method.res.statusCodeWritten).toBe(405);
    expect(method.res.headersWritten).toEqual({ Allow: "POST" });

    const unauthorized = validate({ req: createReq({ headers: { authorization: "Bearer wrong" } }) });
    expect(unauthorized.result).toBeNull();
    expect(unauthorized.res.statusCodeWritten).toBe(401);
    expect(unauthorized.res.body).toBe(JSON.stringify({ error: "unauthorized" }));

    const mediaType = validate({
      req: createReq({
        headers: { authorization: "Bearer owner-token", "content-type": "text/plain" },
      }),
    });
    expect(mediaType.result).toBeNull();
    expect(mediaType.res.statusCodeWritten).toBe(415);
  });

  it("returns 404 for well-known GET probes before method validation", () => {
    const { result, res } = validate({
      req: createReq({ method: "GET", url: "/.well-known/oauth-protected-resource" }),
    });

    expect(result).toBeNull();
    expect(res.statusCodeWritten).toBe(404);
  });

  it("rejects browser origins that are not loopback-local", () => {
    const { result, res } = validate({
      req: createReq({
        headers: {
          authorization: "Bearer owner-token",
          origin: "https://evil.example",
        },
      }),
    });

    expect(result).toBeNull();
    expect(res.statusCodeWritten).toBe(403);
    expect(res.body).toBe(JSON.stringify({ error: "forbidden" }));
  });

  it("allows loopback browser origins for loopback clients", () => {
    const { result } = validate({
      req: createReq({
        headers: {
          authorization: "Bearer owner-token",
          origin: "http://localhost:5173",
        },
        remoteAddress: "::1",
      }),
    });

    expect(result).toEqual({ senderIsOwner: true });
  });
});

describe("MCP loopback body and context helpers", () => {
  it("reads request bodies up to the MCP limit", async () => {
    const req = createReq({});
    const bodyPromise = readMcpHttpBody(req);

    req.emit("data", Buffer.from('{"jsonrpc":"2.0"'));
    req.emit("data", Buffer.from("}"));
    req.emit("end");

    await expect(bodyPromise).resolves.toBe('{"jsonrpc":"2.0"}');
  });

  it("rejects and destroys requests that exceed the MCP body limit", async () => {
    const req = createReq({});
    const bodyPromise = readMcpHttpBody(req);

    req.emit("data", Buffer.alloc(1_048_577));

    await expect(bodyPromise).rejects.toThrow("Request body exceeds 1048576 bytes");
    expect(req.destroy).toHaveBeenCalled();
  });

  it("resolves CoreBlow request context headers", () => {
    const cfg: CoreBlowConfig = {
      agents: { list: [{ id: "main", default: true }] },
    };
    const context = resolveMcpRequestContext(
      createReq({
        headers: {
          "x-session-key": "main",
          "x-coreblow-message-channel": "Telegram",
          "x-coreblow-account-id": "acct-1",
          "x-coreblow-inbound-event-kind": "room_event",
        },
      }),
      cfg,
      { senderIsOwner: false },
    );

    expect(context).toEqual({
      sessionKey: "agent:main:main",
      messageProvider: "telegram",
      accountId: "acct-1",
      inboundEventKind: "room_event",
      senderIsOwner: false,
    });
  });

  it("keeps explicit session keys and ignores OpenClaw-branded context headers", () => {
    const context = resolveMcpRequestContext(
      createReq({
        headers: {
          "x-session-key": "agent:other:work",
          "x-openclaw-message-channel": "telegram",
          "x-openclaw-account-id": "acct-openclaw",
          "x-openclaw-inbound-event-kind": "user_request",
        },
      }),
      {},
      { senderIsOwner: true },
    );

    expect(context).toEqual({
      sessionKey: "agent:other:work",
      messageProvider: undefined,
      accountId: undefined,
      inboundEventKind: undefined,
      senderIsOwner: true,
    });
  });
});
