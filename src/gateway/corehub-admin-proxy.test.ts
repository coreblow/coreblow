import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GATEWAY_TOKEN = "test-gateway-token-1234567890";

let cfg: Record<string, unknown> = {};
const authMock = vi.fn(async () => ({ ok: true }) as { ok: boolean; rateLimited?: boolean });
const upstreamFetchMock = vi.fn();

vi.mock("../config/config.js", () => ({
  loadConfig: () => cfg,
}));

vi.mock("./auth.js", () => ({
  authorizeHttpGatewayConnect: authMock,
}));

const {
  handleCoreHubAdminProxyRequest,
  normalizeCoreHubRegistryUrl,
  resolveCoreHubUpstreamUrl,
} = await import("./corehub-admin-proxy.js");

let port = 0;
let server: ReturnType<typeof createServer> | undefined;

beforeAll(async () => {
  server = createServer((req, res) => {
    void handleCoreHubAdminProxyRequest(req, res, {
      auth: { mode: "token", token: TEST_GATEWAY_TOKEN, allowTailscale: false },
      fetchImpl: upstreamFetchMock as typeof fetch,
    }).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", () => {
      const address = server?.address() as AddressInfo | null;
      if (!address) {
        reject(new Error("server missing address"));
        return;
      }
      port = address.port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server?.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  cfg = {};
  authMock.mockReset();
  authMock.mockResolvedValue({ ok: true });
  upstreamFetchMock.mockReset();
  upstreamFetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, status: "ready" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});

function get(pathname: string, extraHeaders?: Record<string, string>) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers: {
      Authorization: `Bearer ${TEST_GATEWAY_TOKEN}`,
      ...extraHeaders,
    },
  });
}

function post(pathname: string, body: unknown, extraHeaders?: Record<string, string>) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TEST_GATEWAY_TOKEN}`,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

describe("CoreHub admin proxy", () => {
  it("normalizes supported CoreHub registry URLs", () => {
    expect(normalizeCoreHubRegistryUrl("https://coreblow.com/corehub/")).toBe(
      "https://coreblow.com/corehub",
    );
    expect(normalizeCoreHubRegistryUrl("file:///tmp/corehub")).toBeNull();
  });

  it("resolves v2 CoreHub upstream API URLs", () => {
    expect(
      resolveCoreHubUpstreamUrl({
        requestUrl: "/api/corehub/v2/admin/status?limit=5",
        registryUrl: "https://coreblow.com/corehub/",
      }),
    ).toBe("https://coreblow.com/corehub/api/v2/admin/status?limit=5");
  });

  it("authenticates through CoreBlow and forwards CoreHub headers upstream", async () => {
    const response = await get("/api/corehub/v2/admin/status?limit=5", {
      "x-corehub-registry-url": "https://coreblow.com/corehub/",
      "x-corehub-token": "corehub-token",
      "x-corehub-user": "github:coreblow-admin",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "ready" });
    expect(authMock).toHaveBeenCalled();
    expect(upstreamFetchMock).toHaveBeenCalledWith(
      "https://coreblow.com/corehub/api/v2/admin/status?limit=5",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer corehub-token",
          "x-corehub-token": "corehub-token",
          "x-corehub-user": "github:coreblow-admin",
        }),
      }),
    );
  });

  it("rejects requests when Gateway auth fails", async () => {
    authMock.mockResolvedValueOnce({ ok: false, rateLimited: false });

    const response = await get("/api/corehub/v2/admin/status");

    expect(response.status).toBe(401);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it("allows gated review approval and forwards JSON body upstream", async () => {
    const response = await post(
      "/api/corehub/v2/reviews/rev_123/approve",
      { reason: "looks good" },
      {
        "x-corehub-registry-url": "https://coreblow.com/corehub/",
        "x-corehub-token": "corehub-token",
        "x-corehub-user": "github:coreblow-admin",
      },
    );

    expect(response.status).toBe(200);
    expect(upstreamFetchMock).toHaveBeenCalledWith(
      "https://coreblow.com/corehub/api/v2/reviews/rev_123/approve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          authorization: "Bearer corehub-token",
        }),
        body: JSON.stringify({ reason: "looks good" }),
      }),
    );
  });

  it("allows gated review assignment and evidence writes upstream", async () => {
    await post(
      "/api/corehub/v2/reviews/rev_123/assign",
      { assignee: "github:reviewer" },
      {
        "x-corehub-registry-url": "https://coreblow.com/corehub/",
        "x-corehub-token": "corehub-token",
      },
    );

    await post(
      "/api/corehub/v2/reviews/rev_123/evidence",
      { type: "manual_note", summary: "verified publisher claim" },
      {
        "x-corehub-registry-url": "https://coreblow.com/corehub/",
        "x-corehub-token": "corehub-token",
      },
    );

    expect(upstreamFetchMock).toHaveBeenNthCalledWith(
      1,
      "https://coreblow.com/corehub/api/v2/reviews/rev_123/assign",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ assignee: "github:reviewer" }),
      }),
    );
    expect(upstreamFetchMock).toHaveBeenNthCalledWith(
      2,
      "https://coreblow.com/corehub/api/v2/reviews/rev_123/evidence",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "manual_note", summary: "verified publisher claim" }),
      }),
    );
  });

  it("keeps non-review CoreHub writes blocked", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/corehub/v2/submissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_GATEWAY_TOKEN}` },
    });

    expect(response.status).toBe(405);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it("rejects query token forwarding", async () => {
    const response = await get("/api/corehub/v2/admin/status?token=secret");

    expect(response.status).toBe(400);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });
});
