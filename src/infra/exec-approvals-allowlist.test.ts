import { describe, expect, it } from "vitest";
import {
  normalizeSafeBins,
  resolveSafeBins,
} from "./exec-approvals-allowlist.js";

describe("normalizeSafeBins()", () => {
  it("returns empty Set for undefined", () => {
    expect(normalizeSafeBins(undefined).size).toBe(0);
  });

  it("returns empty Set for empty array", () => {
    expect(normalizeSafeBins([]).size).toBe(0);
  });

  it("lowercases entries", () => {
    const result = normalizeSafeBins(["NPM", "Node"]);
    expect(result.has("npm")).toBe(true);
    expect(result.has("node")).toBe(true);
  });

  it("trims whitespace from entries", () => {
    const result = normalizeSafeBins(["  git  ", " curl "]);
    expect(result.has("git")).toBe(true);
    expect(result.has("curl")).toBe(true);
  });

  it("filters out empty entries after trim", () => {
    const result = normalizeSafeBins(["  ", "", "node"]);
    expect(result.has("node")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("deduplicates entries via Set", () => {
    const result = normalizeSafeBins(["git", "GIT", "git"]);
    expect(result.size).toBe(1);
  });
});

describe("resolveSafeBins()", () => {
  it("returns default safe bins for undefined input", () => {
    const result = resolveSafeBins(undefined);
    expect(result.size).toBeGreaterThan(0);
  });

  it("returns empty Set for empty array", () => {
    expect(resolveSafeBins([]).size).toBe(0);
  });

  it("returns empty Set for null", () => {
    expect(resolveSafeBins(null).size).toBe(0);
  });

  it("returns normalized custom entries", () => {
    const result = resolveSafeBins(["GIT", "curl"]);
    expect(result.has("git")).toBe(true);
    expect(result.has("curl")).toBe(true);
  });
});
