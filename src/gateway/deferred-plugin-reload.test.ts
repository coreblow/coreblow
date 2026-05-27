import { describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry-empty.js";
import { refreshDeferredGatewayPluginRuntime } from "./deferred-plugin-reload.js";

describe("refreshDeferredGatewayPluginRuntime", () => {
  it("reloads deferred plugins and replaces the attached method runtime", () => {
    const pluginRegistry = {
      ...createEmptyPluginRegistry(),
      gatewayHandlers: {
        "plugin.reload": vi.fn(),
      },
    };
    const reload = vi.fn(() => ({
      pluginRegistry,
      gatewayMethods: ["health", "plugin.reload"],
    }));
    const replacePluginRegistry = vi.fn();
    const pinHttpRegistry = vi.fn();
    const pinChannelRegistry = vi.fn();

    const loaded = refreshDeferredGatewayPluginRuntime({
      cfg: {},
      workspaceDir: "/tmp/coreblow",
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      coreGatewayHandlers: {},
      baseMethods: ["health"],
      attachedGatewayMethodRuntime: { replacePluginRegistry },
      reload,
      listChannelGatewayMethods: () => ["channel.reload"],
      pinHttpRegistry,
      pinChannelRegistry,
    });

    expect(loaded.pluginRegistry).toBe(pluginRegistry);
    expect(reload).toHaveBeenCalledWith({
      cfg: {},
      workspaceDir: "/tmp/coreblow",
      log: expect.any(Object),
      coreGatewayHandlers: {},
      baseMethods: ["health"],
      logDiagnostics: false,
    });
    expect(replacePluginRegistry).toHaveBeenCalledWith(pluginRegistry, {
      channelMethods: ["channel.reload"],
    });
    expect(pinHttpRegistry).toHaveBeenCalledWith(pluginRegistry);
    expect(pinChannelRegistry).toHaveBeenCalledWith(pluginRegistry);
  });
});
