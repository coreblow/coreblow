/**
 * src/cli/program/subcli-descriptors.test.ts
 *
 * CoreBlow — Sub CLI Descriptors Tests
 * Verifies SUB_CLI_DESCRIPTORS, getSubCliEntries, getSubCliCommandsWithSubcommands.
 */
import { describe, expect, it } from "vitest";
import {
  SUB_CLI_DESCRIPTORS,
  getSubCliEntries,
  getSubCliCommandsWithSubcommands,
} from "./subcli-descriptors.js";

describe("SUB_CLI_DESCRIPTORS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SUB_CLI_DESCRIPTORS)).toBe(true);
    expect(SUB_CLI_DESCRIPTORS.length).toBeGreaterThan(0);
  });

  it("contains 'gateway' entry", () => {
    const names = SUB_CLI_DESCRIPTORS.map((d) => d.name);
    expect(names).toContain("gateway");
  });

  it("each entry has name, description, hasSubcommands", () => {
    for (const d of SUB_CLI_DESCRIPTORS) {
      expect(typeof d.name).toBe("string");
      expect(typeof d.description).toBe("string");
      expect(typeof d.hasSubcommands).toBe("boolean");
    }
  });
});

describe("getSubCliEntries()", () => {
  it("returns same reference as SUB_CLI_DESCRIPTORS", () => {
    expect(getSubCliEntries()).toBe(SUB_CLI_DESCRIPTORS);
  });
});

describe("getSubCliCommandsWithSubcommands()", () => {
  it("returns an array of strings", () => {
    const result = getSubCliCommandsWithSubcommands();
    expect(Array.isArray(result)).toBe(true);
    for (const name of result) {
      expect(typeof name).toBe("string");
    }
  });

  it("contains 'gateway'", () => {
    expect(getSubCliCommandsWithSubcommands()).toContain("gateway");
  });
});
