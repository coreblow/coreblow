import { describe, expect, it } from "vitest";
import {
  buildDefaultControlUiAllowedOrigins,
  hasConfiguredControlUiAllowedOrigins,
  isGatewayNonLoopbackBindMode,
  resolveGatewayPortWithDefault,
} from "./gateway-control-ui-origins.js";

describe("isGatewayNonLoopbackBindMode", () => {
  it("returns true for lan", () => expect(isGatewayNonLoopbackBindMode("lan")).toBe(true));
  it("returns true for tailnet", () => expect(isGatewayNonLoopbackBindMode("tailnet")).toBe(true));
  it("returns true for custom", () => expect(isGatewayNonLoopbackBindMode("custom")).toBe(true));
  it("returns false for localhost", () => expect(isGatewayNonLoopbackBindMode("localhost")).toBe(false));
  it("returns false for undefined", () => expect(isGatewayNonLoopbackBindMode(undefined)).toBe(false));
  it("returns false for empty string", () => expect(isGatewayNonLoopbackBindMode("")).toBe(false));
  it("returns false for number", () => expect(isGatewayNonLoopbackBindMode(8080)).toBe(false));
});

describe("hasConfiguredControlUiAllowedOrigins", () => {
  it("returns true when dangerouslyAllowHostHeaderOriginFallback is true", () => {
    expect(hasConfiguredControlUiAllowedOrigins({
      allowedOrigins: [],
      dangerouslyAllowHostHeaderOriginFallback: true,
    })).toBe(true);
  });

  it("returns true when allowedOrigins has non-empty string", () => {
    expect(hasConfiguredControlUiAllowedOrigins({
      allowedOrigins: ["http://localhost:3000"],
      dangerouslyAllowHostHeaderOriginFallback: false,
    })).toBe(true);
  });

  it("returns false when allowedOrigins is empty array", () => {
    expect(hasConfiguredControlUiAllowedOrigins({
      allowedOrigins: [],
      dangerouslyAllowHostHeaderOriginFallback: false,
    })).toBe(false);
  });

  it("returns false when allowedOrigins has only whitespace strings", () => {
    expect(hasConfiguredControlUiAllowedOrigins({
      allowedOrigins: ["   "],
      dangerouslyAllowHostHeaderOriginFallback: false,
    })).toBe(false);
  });

  it("returns false when allowedOrigins is not an array", () => {
    expect(hasConfiguredControlUiAllowedOrigins({
      allowedOrigins: null,
      dangerouslyAllowHostHeaderOriginFallback: false,
    })).toBe(false);
  });
});

describe("resolveGatewayPortWithDefault", () => {
  it("returns provided port when valid number > 0", () => {
    expect(resolveGatewayPortWithDefault(8080)).toBe(8080);
  });

  it("returns fallback when port is undefined", () => {
    const result = resolveGatewayPortWithDefault(undefined);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("returns fallback when port is 0", () => {
    const result = resolveGatewayPortWithDefault(0);
    expect(result).toBeGreaterThan(0);
  });

  it("returns fallback when port is negative", () => {
    const result = resolveGatewayPortWithDefault(-1);
    expect(result).toBeGreaterThan(0);
  });

  it("uses custom fallback when provided", () => {
    expect(resolveGatewayPortWithDefault(undefined, 9999)).toBe(9999);
  });
});

describe("buildDefaultControlUiAllowedOrigins", () => {
  it("always includes localhost origin", () => {
    const result = buildDefaultControlUiAllowedOrigins({ port: 3000, bind: "lan" });
    expect(result.some((o) => o.includes("localhost:3000"))).toBe(true);
  });

  it("always includes 127.0.0.1 origin", () => {
    const result = buildDefaultControlUiAllowedOrigins({ port: 3000, bind: "lan" });
    expect(result.some((o) => o.includes("127.0.0.1:3000"))).toBe(true);
  });

  it("includes customBindHost when bind=custom and customBindHost provided", () => {
    const result = buildDefaultControlUiAllowedOrigins({
      port: 3000,
      bind: "custom",
      customBindHost: "myhost.local",
    });
    expect(result.some((o) => o.includes("myhost.local"))).toBe(true);
  });

  it("does not include customBindHost when bind=lan", () => {
    const result = buildDefaultControlUiAllowedOrigins({
      port: 3000,
      bind: "lan",
      customBindHost: "myhost.local",
    });
    expect(result.some((o) => o.includes("myhost.local"))).toBe(false);
  });

  it("returns array of strings", () => {
    const result = buildDefaultControlUiAllowedOrigins({ port: 4000, bind: "tailnet" });
    expect(Array.isArray(result)).toBe(true);
    for (const origin of result) {
      expect(typeof origin).toBe("string");
    }
  });
});
