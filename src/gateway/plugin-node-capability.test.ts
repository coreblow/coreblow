import { describe, expect, test } from "vitest";
import {
  buildPluginNodeCapabilityScopedHostUrl,
  hasAuthorizedPluginNodeCapability,
  indexPluginNodeCapabilitySurfaces,
  normalizePluginNodeCapabilityScopedUrl,
  refreshClientPluginNodeCapability,
  replacePluginNodeCapabilityInScopedHostUrl,
  setClientPluginNodeCapability,
} from "./plugin-node-capability.js";
import type { GatewayWsClient } from "./server/ws-types.js";

function makeClient(
  overrides: Partial<GatewayWsClient> & {
    pluginNodeCapabilities?: GatewayWsClient["pluginNodeCapabilities"];
  } = {},
): GatewayWsClient {
  return {
    socket: {} as GatewayWsClient["socket"],
    connect: {
      client: {
        id: "node-host",
        mode: "node",
      },
    } as GatewayWsClient["connect"],
    connId: "node-1",
    ...overrides,
  };
}

describe("plugin node capability helpers", () => {
  test("builds scoped host urls from clean base urls", () => {
    expect(
      buildPluginNodeCapabilityScopedHostUrl(
        "http://127.0.0.1:18789/root/?debug=1#hash",
        "token value",
      ),
    ).toBe("http://127.0.0.1:18789/root/__coreblow__/cap/token%20value");
    expect(buildPluginNodeCapabilityScopedHostUrl("not a url", "token")).toBeUndefined();
    expect(buildPluginNodeCapabilityScopedHostUrl("http://127.0.0.1:18789", " ")).toBeUndefined();
  });

  test("normalizes scoped urls and moves capability into the established query string", () => {
    const normalized = normalizePluginNodeCapabilityScopedUrl(
      "/__coreblow__/cap/token%20value/__coreblow__/canvas/file.txt?download=1",
    );
    expect(normalized).toEqual({
      pathname: "/__coreblow__/canvas/file.txt",
      capability: "token value",
      rewrittenUrl: "/__coreblow__/canvas/file.txt?download=1&oc_cap=token+value",
      scopedPath: true,
      malformedScopedPath: false,
    });
  });

  test("replaces scoped capability tokens without nesting capability prefixes", () => {
    expect(
      replacePluginNodeCapabilityInScopedHostUrl(
        "http://127.0.0.1:18789/__coreblow__/cap/old-token/__coreblow__/a2ui/",
        "new token",
      ),
    ).toBe("http://127.0.0.1:18789/__coreblow__/cap/new%20token/__coreblow__/a2ui");
  });

  test("rejects malformed scoped request targets without throwing", () => {
    const malformedScoped = normalizePluginNodeCapabilityScopedUrl("/__coreblow__/cap/broken");
    expect(malformedScoped).toMatchObject({
      scopedPath: true,
      malformedScopedPath: true,
      capability: undefined,
      rewrittenUrl: undefined,
    });
    for (const rawUrl of ["//", "///", "//${jndi:ldap://example}.action"]) {
      const normalized = normalizePluginNodeCapabilityScopedUrl(rawUrl);
      expect(normalized).toMatchObject({
        pathname: "/",
        scopedPath: false,
        malformedScopedPath: true,
      });
      expect(normalized.capability).toBeUndefined();
      expect(normalized.rewrittenUrl).toBeUndefined();
    }
  });

  test("stores capabilities separately by surface and plugin-owned scope", () => {
    const client = makeClient();
    setClientPluginNodeCapability({
      client,
      surface: { surface: "canvas", scopeKey: "canvas-plugin:canvas" },
      capability: "canvas-token",
      expiresAtMs: 100,
    });
    setClientPluginNodeCapability({
      client,
      surface: { surface: "canvas", scopeKey: "other-plugin:canvas" },
      capability: "other-token",
      expiresAtMs: 200,
    });
    setClientPluginNodeCapability({
      client,
      surface: { surface: "files" },
      capability: "files-token",
      expiresAtMs: 300,
    });

    expect(client.pluginNodeCapabilities).toEqual({
      "canvas\u0000canvas-plugin:canvas": { capability: "canvas-token", expiresAtMs: 100 },
      "canvas\u0000other-plugin:canvas": { capability: "other-token", expiresAtMs: 200 },
      files: { capability: "files-token", expiresAtMs: 300 },
    });
  });

  test("indexes plugin capability surfaces with the shortest ttl per surface", () => {
    expect(
      indexPluginNodeCapabilitySurfaces([
        { surface: "canvas", ttlMs: 5_000 },
        { surface: " canvas ", ttlMs: 100 },
        { surface: "files" },
      ]),
    ).toEqual({
      canvas: { surface: "canvas", ttlMs: 100 },
      files: { surface: "files" },
    });
  });

  test("refreshes a plugin surface url and stores its new capability", () => {
    const client = makeClient({
      pluginSurfaceUrls: {
        canvas: "http://127.0.0.1:18789/__coreblow__/cap/old-token",
      },
      pluginNodeCapabilitySurfaces: {
        canvas: { surface: "canvas", ttlMs: 100 },
      },
    });
    const refreshed = refreshClientPluginNodeCapability({
      client,
      surface: { surface: "canvas" },
      nowMs: 1_000,
    });

    expect(refreshed?.surface).toBe("canvas");
    expect(refreshed?.expiresAtMs).toBe(1_100);
    expect(refreshed?.capability).toBeTypeOf("string");
    expect(refreshed?.scopedUrl).toContain("/__coreblow__/cap/");
    expect(refreshed?.scopedUrl).not.toContain("old-token/__coreblow__/cap/");
    expect(client.pluginSurfaceUrls?.canvas).toBe(refreshed?.scopedUrl);
    expect(client.pluginNodeCapabilities?.canvas).toEqual({
      capability: refreshed?.capability,
      expiresAtMs: 1_100,
    });
  });

  test("authorizes matching scoped capabilities with sliding expiry only in their scope", () => {
    const client = makeClient({
      pluginNodeCapabilities: {
        "canvas\u0000canvas-plugin:canvas": { capability: "canvas-token", expiresAtMs: 1_500 },
      },
    });
    const clients = new Set([client]);

    expect(
      hasAuthorizedPluginNodeCapability({
        clients,
        surface: { surface: "canvas", scopeKey: "other-plugin:canvas" },
        capability: "canvas-token",
        nowMs: 1_000,
      }),
    ).toBe(false);
    expect(
      hasAuthorizedPluginNodeCapability({
        clients,
        surface: { surface: "canvas", scopeKey: "canvas-plugin:canvas", ttlMs: 100 },
        capability: "canvas-token",
        nowMs: 1_000,
      }),
    ).toBe(true);
    expect(client.pluginNodeCapabilities?.["canvas\u0000canvas-plugin:canvas"]?.expiresAtMs).toBe(
      1_100,
    );
    expect(
      hasAuthorizedPluginNodeCapability({
        clients,
        surface: { surface: "canvas", scopeKey: "canvas-plugin:canvas" },
        capability: "wrong",
        nowMs: 1_000,
      }),
    ).toBe(false);
  });

  test("rejects expired capabilities", () => {
    const client = makeClient({
      pluginNodeCapabilities: {
        canvas: { capability: "canvas-token", expiresAtMs: 999 },
      },
    });
    expect(
      hasAuthorizedPluginNodeCapability({
        clients: new Set([client]),
        surface: { surface: "canvas" },
        capability: "canvas-token",
        nowMs: 1_000,
      }),
    ).toBe(false);
  });
});
