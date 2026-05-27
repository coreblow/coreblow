import { describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../../plugins/registry-empty.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import type { GatewayRequestHandler } from "../server-methods/types.js";
import { createAttachedGatewayMethodRegistrySnapshot } from "./attached-registry.js";

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
});
