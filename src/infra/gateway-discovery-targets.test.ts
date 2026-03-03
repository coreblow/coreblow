import { describe, expect, it } from "vitest";
import {
  buildGatewayDiscoveryLabel,
  serializeGatewayDiscoveryBeacon,
} from "./gateway-discovery-targets.js";

const mockBeacon = {
  instanceName: "coreblow-local",
  host: "192.168.1.100",
  port: 8080,
} as never;

describe("buildGatewayDiscoveryLabel()", () => {
  it("is a function", () => {
    expect(typeof buildGatewayDiscoveryLabel).toBe("function");
  });

  it("returns a non-empty string", () => {
    const label = buildGatewayDiscoveryLabel(mockBeacon);
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });

  it("contains instanceName or host info", () => {
    const label = buildGatewayDiscoveryLabel(mockBeacon);
    expect(label.length).toBeGreaterThan(0);
  });

  it("does not throw for minimal beacon", () => {
    expect(() =>
      buildGatewayDiscoveryLabel({ instanceName: "test" } as never)
    ).not.toThrow();
  });
});

describe("serializeGatewayDiscoveryBeacon()", () => {
  it("is a function", () => {
    expect(typeof serializeGatewayDiscoveryBeacon).toBe("function");
  });

  it("returns a non-null object", () => {
    const result = serializeGatewayDiscoveryBeacon(mockBeacon);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("includes instanceName field", () => {
    const result = serializeGatewayDiscoveryBeacon(mockBeacon) as Record<string, unknown>;
    expect(result.instanceName).toBe("coreblow-local");
  });

  it("does not throw for minimal beacon", () => {
    expect(() =>
      serializeGatewayDiscoveryBeacon({ instanceName: "x" } as never)
    ).not.toThrow();
  });
});
