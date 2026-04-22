import { describe, expect, it } from "vitest";
import { setVersion, registerProbe, removeProbe, checkHealth } from "./health-check.js";

describe("setVersion()", () => {
  it("does not throw", () => {
    expect(() => setVersion("1.2.3")).not.toThrow();
  });

  it("is a function", () => {
    expect(typeof setVersion).toBe("function");
  });
});

describe("registerProbe() + removeProbe()", () => {
  it("registerProbe does not throw", () => {
    expect(() =>
      registerProbe("test-probe", async () => ({ status: "healthy" as const, details: {}, lastChecked: Date.now() }))
    ).not.toThrow();
  });

  it("removeProbe returns boolean", () => {
    registerProbe("removable-probe", async () => ({ status: "healthy" as const, details: {}, lastChecked: Date.now() }));
    const result = removeProbe("removable-probe");
    expect(typeof result).toBe("boolean");
  });

  it("removeProbe returns false for unknown probe", () => {
    expect(removeProbe("nonexistent-xyz")).toBe(false);
  });
});

describe("checkHealth()", () => {
  it("returns a Promise", () => {
    const result = checkHealth();
    expect(result instanceof Promise).toBe(true);
  });

  it("resolves to object with status", async () => {
    const result = await checkHealth();
    expect(typeof result).toBe("object");
    expect("status" in result).toBe(true);
  });
});
