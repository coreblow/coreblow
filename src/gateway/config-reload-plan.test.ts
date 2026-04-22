/**
 * src/gateway/config-reload-plan.test.ts
 *
 * CoreBlow — Gateway Config Reload Plan Tests
 * Verifies buildGatewayReloadPlan: fields, restartGateway flag,
 * noopPaths behavior, and return shape.
 */
import { describe, expect, it } from "vitest";
import { buildGatewayReloadPlan } from "./config-reload-plan.js";

describe("buildGatewayReloadPlan()", () => {
  it("is a function", () => {
    expect(typeof buildGatewayReloadPlan).toBe("function");
  });

  it("returns an object for empty changed paths", () => {
    const plan = buildGatewayReloadPlan([]);
    expect(typeof plan).toBe("object");
    expect(plan).not.toBeNull();
  });

  it("returned plan has changedPaths field", () => {
    const plan = buildGatewayReloadPlan(["gateway.auth.password"]);
    expect(Array.isArray(plan.changedPaths)).toBe(true);
  });

  it("returned plan has restartGateway boolean", () => {
    const plan = buildGatewayReloadPlan([]);
    expect(typeof plan.restartGateway).toBe("boolean");
  });

  it("returned plan has restartReasons array", () => {
    const plan = buildGatewayReloadPlan([]);
    expect(Array.isArray(plan.restartReasons)).toBe(true);
  });

  it("returned plan has hotReasons array", () => {
    const plan = buildGatewayReloadPlan([]);
    expect(Array.isArray(plan.hotReasons)).toBe(true);
  });

  it("returned plan has restartChannels Set", () => {
    const plan = buildGatewayReloadPlan([]);
    expect(plan.restartChannels instanceof Set).toBe(true);
  });

  it("returned plan has noopPaths array", () => {
    const plan = buildGatewayReloadPlan([]);
    expect(Array.isArray(plan.noopPaths)).toBe(true);
  });

  it("gateway.remote path is treated as noop", () => {
    const plan = buildGatewayReloadPlan(["gateway.remote"]);
    expect(plan.restartGateway).toBe(false);
  });

  it("gateway.auth path triggers restart", () => {
    const plan = buildGatewayReloadPlan(["gateway.auth"]);
    expect(plan.restartGateway).toBe(true);
  });
});
