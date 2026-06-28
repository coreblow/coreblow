import { describe, expect, it } from "vitest";
import { unwrapDefaultModuleExport } from "./module-export.js";

describe("unwrapDefaultModuleExport", () => {
  it("returns the value unchanged when it has no default export", () => {
    const value = { hello: "world" };
    expect(unwrapDefaultModuleExport(value)).toBe(value);
  });

  it("unwraps a single level of default export", () => {
    const inner = { hello: "world" };
    expect(unwrapDefaultModuleExport({ default: inner })).toBe(inner);
  });

  it("unwraps nested default exports recursively", () => {
    const inner = { hello: "world" };
    expect(unwrapDefaultModuleExport({ default: { default: inner } })).toBe(inner);
  });

  it("handles primitive and nullish input safely", () => {
    expect(unwrapDefaultModuleExport(null)).toBe(null);
    expect(unwrapDefaultModuleExport(undefined)).toBe(undefined);
    expect(unwrapDefaultModuleExport("plain-string")).toBe("plain-string");
    expect(unwrapDefaultModuleExport(42)).toBe(42);
  });

  it("stops at a circular default-export cycle instead of looping forever", () => {
    const cyclic: { default?: unknown } = {};
    cyclic.default = cyclic;
    expect(unwrapDefaultModuleExport(cyclic)).toBe(cyclic);
  });
});
