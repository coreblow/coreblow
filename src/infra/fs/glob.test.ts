import { describe, expect, it } from "vitest";
import { globSync } from "./glob.js";
import { tmpdir } from "node:os";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("globSync()", () => {
  it("is a function", () => {
    expect(typeof globSync).toBe("function");
  });

  it("returns an array", () => {
    const result = globSync(tmpdir(), "*.ts");
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array for non-existent dir", () => {
    const result = globSync("/this/dir/does/not/exist-xyz", "*.ts");
    expect(result).toEqual([]);
  });

  it("finds .ts files in a temp directory", () => {
    const dir = join(tmpdir(), `coreblow-glob-test-${Date.now()}`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "test-file.ts"), "export {};");
      writeFileSync(join(dir, "other.js"), "// js");
      const result = globSync(dir, "*.ts");
      expect(result.some((f) => f.endsWith("test-file.ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not include files of other extensions", () => {
    const dir = join(tmpdir(), `coreblow-glob-test-ext-${Date.now()}`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "readme.md"), "# README");
      const result = globSync(dir, "*.ts");
      expect(result.every((f) => f.endsWith(".ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
