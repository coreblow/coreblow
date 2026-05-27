import { describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../../plugins/registry-empty.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import type { GatewayRequestHandler } from "../server-methods/types.js";
import {
  createAttachedGatewayMethodRegistryRuntime,
  createAttachedGatewayMethodRegistrySnapshot,
} from "./attached-registry.js";

const coreHandler: GatewayRequestHandler = ({ respond }) => respond(true, { source: "core" });
const pluginHandler: GatewayRequestHandler = ({ respond }) =>
  respond(true, { source: "plugin" });
const auxHandler: GatewayRequestHandler = ({ respond }) => respond(true, { source: "aux" });

function createPluginRegistry(
  overrides: Partial<PluginRegistry> = {},
): PluginRegistry {
  return {
    ...createEmptyPluginRegistry(),
    ...overrides,
  };
}

describe("attached gateway method registry snapshot", () => {
  it("advertises and dispatches plugin and aux methods from the same snapshot", () => {
    const pluginRegistry = createPluginRegistry({
      gatewayHandlers: {
        "plugin.snapshot": pluginHandler,
      },
    });

    const snapshot = createAttachedGatewayMethodRegistrySnapshot({
      coreGatewayHandlers: {
        health: coreHandler,
      },
      pluginRegistry,
      extraHandlers: {
        "plugin.snapshot": pluginHandler,
        "aux.snapshot": auxHandler,
      },
      channelMethods: ["channel.snapshot"],
    });

    expect(snapshot.gatewayMethods).toEqual(
      expect.arrayContaining(["health", "plugin.snapshot", "aux.snapshot", "channel.snapshot"]),
    );
    expect(snapshot.methodRegistry.getHandler("plugin.snapshot")).toBe(pluginHandler);
    expect(snapshot.methodRegistry.getHandler("aux.snapshot")).toBe(auxHandler);
  });

  it("uses the same registry metadata for control-plane dispatch", () => {
    const configPatchHandler = vi.fn<GatewayRequestHandler>(({ respond }) =>
      respond(true, { source: "override" }),
    );
    const snapshot = createAttachedGatewayMethodRegistrySnapshot({
      coreGatewayHandlers: {
        health: coreHandler,
      },
      pluginRegistry: createPluginRegistry(),
      extraHandlers: {
        "config.patch": configPatchHandler,
      },
    });

    expect(snapshot.gatewayMethods).toContain("config.patch");
    expect(snapshot.methodRegistry.getHandler("config.patch")).toBe(configPatchHandler);
    expect(snapshot.methodRegistry.isControlPlaneWrite("config.patch")).toBe(true);
  });

  it("replaces plugin handlers and advertised methods in-place during deferred reloads", () => {
    const firstPluginHandler: GatewayRequestHandler = ({ respond }) =>
      respond(true, { source: "first-plugin" });
    const secondPluginHandler: GatewayRequestHandler = ({ respond }) =>
      respond(true, { source: "second-plugin" });
    const runtime = createAttachedGatewayMethodRegistryRuntime({
      coreGatewayHandlers: {
        health: coreHandler,
      },
      pluginRegistry: createPluginRegistry({
        gatewayHandlers: {
          "plugin.first": firstPluginHandler,
        },
      }),
      extraHandlers: {
        "aux.snapshot": auxHandler,
      },
      channelMethods: ["channel.first"],
    });
    const advertisedMethods = runtime.gatewayMethods;
    const extraHandlers = runtime.extraHandlers;

    runtime.replacePluginRegistry(
      createPluginRegistry({
        gatewayHandlers: {
          "plugin.second": secondPluginHandler,
        },
      }),
      { channelMethods: ["channel.second"] },
    );

    expect(runtime.gatewayMethods).toBe(advertisedMethods);
    expect(runtime.extraHandlers).toBe(extraHandlers);
    expect(runtime.gatewayMethods).toEqual(
      expect.arrayContaining(["health", "plugin.second", "aux.snapshot", "channel.second"]),
    );
    expect(runtime.gatewayMethods).not.toContain("plugin.first");
    expect(runtime.gatewayMethods).not.toContain("channel.first");
    expect(runtime.extraHandlers["plugin.first"]).toBeUndefined();
    expect(runtime.extraHandlers["plugin.second"]).toBe(secondPluginHandler);
    expect(runtime.getMethodRegistry().getHandler("plugin.first")).toBeUndefined();
    expect(runtime.getMethodRegistry().getHandler("plugin.second")).toBe(secondPluginHandler);
    expect(runtime.getMethodRegistry().getHandler("aux.snapshot")).toBe(auxHandler);
  });
});
