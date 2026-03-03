import { describe, expect, it } from "vitest";
import {
  normalizeSafeBinName,
  getSafeBinSemanticRule,
  validateSafeBinSemantics,
  listRiskyConfiguredSafeBins,
} from "./exec-safe-bin-semantics.js";

describe("normalizeSafeBinName()", () => {
  it("lowercases input", () => {
    expect(normalizeSafeBinName("NPM")).toBe("npm");
  });

  it("trims whitespace", () => {
    expect(normalizeSafeBinName("  node  ")).toBe("node");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeSafeBinName("")).toBe("");
    expect(normalizeSafeBinName("   ")).toBe("");
  });

  it("extracts basename from path", () => {
    const result = normalizeSafeBinName("/usr/bin/python3");
    expect(result).toBe("python3");
  });
});

describe("getSafeBinSemanticRule()", () => {
  it("returns undefined for unknown bin", () => {
    expect(getSafeBinSemanticRule("totally-unknown-bin-xyz")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getSafeBinSemanticRule("")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(getSafeBinSemanticRule(undefined)).toBeUndefined();
  });
});

describe("validateSafeBinSemantics()", () => {
  it("returns true for unknown bin (no rule = allow)", () => {
    const result = validateSafeBinSemantics({
      binName: "unknown-bin-xyz",
      positional: ["unknown-bin-xyz", "--flag"],
    });
    expect(result).toBe(true);
  });
});

describe("listRiskyConfiguredSafeBins()", () => {
  it("returns an array", () => {
    const result = listRiskyConfiguredSafeBins([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(listRiskyConfiguredSafeBins([])).toHaveLength(0);
  });

  it("returns array of {bin, warning} objects for risky bins", () => {
    const result = listRiskyConfiguredSafeBins(["curl", "wget"]);
    for (const item of result) {
      const r = item as { bin: string; warning: string };
      expect(typeof r.bin).toBe("string");
      expect(typeof r.warning).toBe("string");
    }
  });
});
