import { afterEach, describe, expect, it, vi } from "vitest";
import { isRoleAuthorizedForMethod } from "../role-policy.js";
import { listGatewayMethods } from "../server-methods-list.js";
import { nodeHandlers } from "./nodes.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("node.pluginSurface.refresh", () => {
  it("advertises a node-only refresh method and rotates the requested plugin capability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const respond = vi.fn();
    const client = {
      connect: { role: "node", client: { id: "node-1" } },
      pluginSurfaceUrls: {
        canvas: "http://127.0.0.1:18789/__coreblow__/cap/old-token",
      },
      pluginNodeCapabilitySurfaces: {
        canvas: { surface: "canvas", ttlMs: 100 },
      },
    };

    expect(listGatewayMethods()).toContain("node.pluginSurface.refresh");
    expect(isRoleAuthorizedForMethod("node", "node.pluginSurface.refresh")).toBe(true);
    expect(isRoleAuthorizedForMethod("operator", "node.pluginSurface.refresh")).toBe(false);

    await nodeHandlers["node.pluginSurface.refresh"]({
      req: { type: "req", id: "req-1", method: "node.pluginSurface.refresh" },
      params: { surface: "canvas" },
      respond,
      context: {} as never,
      client: client as never,
      isWebchatConnect: () => false,
    });

    expect(respond).toHaveBeenCalledTimes(1);
    const payload = respond.mock.calls[0]?.[1] as
      | {
          surface: string;
          pluginSurfaceUrls: Record<string, string>;
          expiresAtMs: number;
        }
      | undefined;
    expect(respond.mock.calls[0]?.[0]).toBe(true);
    expect(payload?.surface).toBe("canvas");
    expect(payload?.expiresAtMs).toBe(1_100);
    const canvasUrl = payload?.pluginSurfaceUrls.canvas ?? "";
    expect(canvasUrl).toMatch(/^http:\/\/127\.0\.0\.1:18789\/__coreblow__\/cap\/.+/);
    expect(canvasUrl).not.toContain("old-token");
    expect(client.pluginSurfaceUrls.canvas).toBe(canvasUrl);
  });

  it("rejects a missing surface before attempting refresh", async () => {
    const respond = vi.fn();

    await nodeHandlers["node.pluginSurface.refresh"]({
      req: { type: "req", id: "req-2", method: "node.pluginSurface.refresh" },
      params: {},
      respond,
      context: {} as never,
      client: null,
      isWebchatConnect: () => false,
    });

    expect(respond.mock.calls[0]?.[0]).toBe(false);
    expect(respond.mock.calls[0]?.[2]?.message).toBe("surface required");
  });
});
