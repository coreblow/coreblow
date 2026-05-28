import { describe, expect, it } from "vitest";
import { STARTUP_UNAVAILABLE_GATEWAY_METHODS } from "./methods/core-descriptors.js";
import {
  createStartupUnavailableGatewayMethods,
  markStartupUnavailableGatewayMethodsReady,
} from "./startup-unavailable-methods.js";

describe("gateway startup unavailable method lifecycle", () => {
  it("starts with startup-gated methods enabled by default", () => {
    const methods = createStartupUnavailableGatewayMethods();

    expect([...methods].sort()).toEqual([...STARTUP_UNAVAILABLE_GATEWAY_METHODS].sort());
  });

  it("can start empty for minimal test gateways", () => {
    const methods = createStartupUnavailableGatewayMethods({ enabled: false });

    expect(methods.size).toBe(0);
  });

  it("clears only the startup-gated methods when sidecars are ready", () => {
    const methods = createStartupUnavailableGatewayMethods();
    methods.add("plugin.custom");

    markStartupUnavailableGatewayMethodsReady(methods);

    expect(methods.has("plugin.custom")).toBe(true);
    for (const method of STARTUP_UNAVAILABLE_GATEWAY_METHODS) {
      expect(methods.has(method)).toBe(false);
    }
  });
});
