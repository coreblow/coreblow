import { describe, expect, it } from "vitest";
import { isTypeScriptPackageEntry, listBuiltRuntimeEntryCandidates } from "./package-entrypoints.js";

describe("isTypeScriptPackageEntry", () => {
  it("returns true for .ts files", () => {
    expect(isTypeScriptPackageEntry("src/index.ts")).toBe(true);
    expect(isTypeScriptPackageEntry("./plugin.ts")).toBe(true);
    expect(isTypeScriptPackageEntry("file.TS")).toBe(true);
  });

  it("returns true for .mts files", () => {
    expect(isTypeScriptPackageEntry("src/module.mts")).toBe(true);
    expect(isTypeScriptPackageEntry("./plugin.MTS")).toBe(true);
  });

  it("returns true for .cts files", () => {
    expect(isTypeScriptPackageEntry("src/common.cts")).toBe(true);
    expect(isTypeScriptPackageEntry("./plugin.CTS")).toBe(true);
  });

  it("returns false for non-TypeScript files", () => {
    expect(isTypeScriptPackageEntry("src/index.js")).toBe(false);
    expect(isTypeScriptPackageEntry("src/module.mjs")).toBe(false);
    expect(isTypeScriptPackageEntry("src/common.cjs")).toBe(false);
    expect(isTypeScriptPackageEntry("src/file.json")).toBe(false);
    expect(isTypeScriptPackageEntry("src/readme.md")).toBe(false);
  });
});

describe("listBuiltRuntimeEntryCandidates", () => {
  it("returns empty array for non-TypeScript files", () => {
    expect(listBuiltRuntimeEntryCandidates("src/index.js")).toEqual([]);
    expect(listBuiltRuntimeEntryCandidates("src/module.mjs")).toEqual([]);
    expect(listBuiltRuntimeEntryCandidates("file.json")).toEqual([]);
  });

  it("generates dist candidates for src/ TypeScript files", () => {
    const candidates = listBuiltRuntimeEntryCandidates("src/index.ts");
    expect(candidates).toContain("./dist/index.js");
    expect(candidates).toContain("./dist/index.mjs");
    expect(candidates).toContain("./dist/index.cjs");
  });

  it("generates both dist and same-dir candidates for non-src TypeScript files", () => {
    const candidates = listBuiltRuntimeEntryCandidates("./plugin.ts");
    expect(candidates).toContain("./dist/plugin.js");
    expect(candidates).toContain("./dist/plugin.mjs");
    expect(candidates).toContain("./dist/plugin.cjs");
    expect(candidates).toContain("./plugin.js");
    expect(candidates).toContain("./plugin.mjs");
    expect(candidates).toContain("./plugin.cjs");
  });

  it("handles nested src/ paths correctly", () => {
    const candidates = listBuiltRuntimeEntryCandidates("src/utils/helper.ts");
    expect(candidates).toContain("./dist/utils/helper.js");
    expect(candidates).toContain("./dist/utils/helper.mjs");
    expect(candidates).toContain("./dist/utils/helper.cjs");
  });

  it("handles .mts files", () => {
    const candidates = listBuiltRuntimeEntryCandidates("src/module.mts");
    expect(candidates).toContain("./dist/module.js");
    expect(candidates).toContain("./dist/module.mjs");
    expect(candidates).toContain("./dist/module.cjs");
  });

  it("handles .cts files", () => {
    const candidates = listBuiltRuntimeEntryCandidates("src/common.cts");
    expect(candidates).toContain("./dist/common.js");
    expect(candidates).toContain("./dist/common.mjs");
    expect(candidates).toContain("./dist/common.cjs");
  });

  it("excludes the original TypeScript file from candidates", () => {
    const candidates = listBuiltRuntimeEntryCandidates("src/index.ts");
    expect(candidates).not.toContain("src/index.ts");
  });

  it("deduplicates candidates", () => {
    const candidates = listBuiltRuntimeEntryCandidates("./plugin.ts");
    const unique = [...new Set(candidates)];
    expect(candidates.length).toBe(unique.length);
  });

  it("normalizes backslashes to forward slashes", () => {
    const candidates = listBuiltRuntimeEntryCandidates("src\\utils\\helper.ts");
    expect(candidates.every((c) => !c.includes("\\"))).toBe(true);
    expect(candidates).toContain("./dist/utils/helper.js");
  });

  it("strips leading ./ from normalized paths when building dist paths", () => {
    const candidates = listBuiltRuntimeEntryCandidates("./src/index.ts");
    expect(candidates).toContain("./dist/index.js");
  });
});
