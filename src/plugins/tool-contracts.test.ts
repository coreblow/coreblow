import { describe, expect, it } from "vitest";
import {
  findUndeclaredPluginToolNames,
  normalizePluginToolContractNames,
  normalizePluginToolNames,
} from "./tool-contracts.js";

describe("normalizePluginToolNames", () => {
  it("should return empty array for undefined", () => {
    expect(normalizePluginToolNames(undefined)).toEqual([]);
  });

  it("should return empty array for empty array", () => {
    expect(normalizePluginToolNames([])).toEqual([]);
  });

  it("should trim whitespace from tool names", () => {
    expect(normalizePluginToolNames([" tool1 ", "  tool2  "])).toEqual(["tool1", "tool2"]);
  });

  it("should deduplicate tool names", () => {
    expect(normalizePluginToolNames(["tool1", "tool1", "tool2"])).toEqual(["tool1", "tool2"]);
  });

  it("should skip empty strings after trimming", () => {
    expect(normalizePluginToolNames(["tool1", "  ", "", "tool2"])).toEqual(["tool1", "tool2"]);
  });
});

describe("normalizePluginToolContractNames", () => {
  it("should return empty array for undefined contracts", () => {
    expect(normalizePluginToolContractNames(undefined)).toEqual([]);
  });

  it("should extract and normalize tools from contracts", () => {
    expect(normalizePluginToolContractNames({ tools: [" tool1 ", "tool2"] })).toEqual([
      "tool1",
      "tool2",
    ]);
  });

  it("should handle empty tools array", () => {
    expect(normalizePluginToolContractNames({ tools: [] })).toEqual([]);
  });
});

describe("findUndeclaredPluginToolNames", () => {
  it("should return empty array when all tools are declared", () => {
    expect(
      findUndeclaredPluginToolNames({
        declaredNames: ["tool1", "tool2"],
        toolNames: ["tool1", "tool2"],
      }),
    ).toEqual([]);
  });

  it("should find undeclared tool names", () => {
    expect(
      findUndeclaredPluginToolNames({
        declaredNames: ["tool1"],
        toolNames: ["tool1", "tool2", "tool3"],
      }),
    ).toEqual(["tool2", "tool3"]);
  });

  it("should normalize before comparing", () => {
    expect(
      findUndeclaredPluginToolNames({
        declaredNames: [" tool1 ", "tool2"],
        toolNames: ["tool1", " tool3 "],
      }),
    ).toEqual(["tool3"]);
  });

  it("should return empty array when toolNames is empty", () => {
    expect(
      findUndeclaredPluginToolNames({
        declaredNames: ["tool1"],
        toolNames: [],
      }),
    ).toEqual([]);
  });

  it("should skip empty tool names after trimming", () => {
    expect(
      findUndeclaredPluginToolNames({
        declaredNames: ["tool1"],
        toolNames: ["tool1", "  ", "tool2"],
      }),
    ).toEqual(["tool2"]);
  });
});
