// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  resolveVersionFromModuleUrl,
  resolveUsableRuntimeVersion,
  resolveCompatibilityHostVersion,
} from "./version.js";

describe("version resolution", () => {
  it("returns null for malformed module URLs", () => {
    expect(resolveVersionFromModuleUrl("")).toBeNull();
    expect(resolveVersionFromModuleUrl("not-a-url")).toBeNull();
  });

  it("normalizes runtime version candidate for fallback handling", () => {
    expect(resolveUsableRuntimeVersion(undefined)).toBeUndefined();
    expect(resolveUsableRuntimeVersion("")).toBeUndefined();
    expect(resolveUsableRuntimeVersion("  ")).toBeUndefined();
    expect(resolveUsableRuntimeVersion("1.2.3")).toBe("1.2.3");
  });

  it("resolves compatibility host version from env and runtime", () => {
    const result = resolveCompatibilityHostVersion({
      env: { VERSION: "2.0.0" },
    });
    expect(typeof result).toBe("string");
  });
});
