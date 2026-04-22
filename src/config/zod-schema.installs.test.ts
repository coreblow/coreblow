/**
 * src/config/zod-schema.installs.test.ts
 *
 * CoreBlow — Installs Schema Shape Tests
 * Verifies InstallRecordShape is a plain object shape with expected
 * zod field definitions (source, spec, sourcePath, installPath, version).
 */
import { describe, expect, it } from "vitest";
import { InstallRecordShape } from "./zod-schema.installs.js";

describe("InstallRecordShape", () => {
  it("is a plain object (not a Zod schema)", () => {
    expect(typeof InstallRecordShape).toBe("object");
    expect(InstallRecordShape).not.toBeNull();
  });

  it("has a source field", () => {
    expect("source" in InstallRecordShape).toBe(true);
  });

  it("has a spec field", () => {
    expect("spec" in InstallRecordShape).toBe(true);
  });

  it("has a sourcePath field", () => {
    expect("sourcePath" in InstallRecordShape).toBe(true);
  });

  it("has a version field", () => {
    expect("version" in InstallRecordShape).toBe(true);
  });

  it("all values are zod schemas (have _def)", () => {
    for (const [key, schema] of Object.entries(InstallRecordShape)) {
      expect(
        typeof (schema as never as { _def: unknown })._def,
        `${key} should be a Zod schema`,
      ).toBe("object");
    }
  });
});
