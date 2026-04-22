/**
 * src/cli/program/core-command-descriptors.test.ts
 *
 * CoreBlow — Core CLI Command Descriptors Tests
 * Verifies CORE_CLI_COMMAND_DESCRIPTORS, getCoreCliCommandDescriptors,
 * getCoreCliCommandsWithSubcommands.
 */
import { describe, expect, it } from "vitest";
import {
  CORE_CLI_COMMAND_DESCRIPTORS,
  getCoreCliCommandDescriptors,
  getCoreCliCommandsWithSubcommands,
} from "./core-command-descriptors.js";

describe("CORE_CLI_COMMAND_DESCRIPTORS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(CORE_CLI_COMMAND_DESCRIPTORS)).toBe(true);
    expect(CORE_CLI_COMMAND_DESCRIPTORS.length).toBeGreaterThan(0);
  });

  it("each descriptor has name and description", () => {
    for (const d of CORE_CLI_COMMAND_DESCRIPTORS) {
      expect(typeof d.name).toBe("string");
      expect(typeof d.description).toBe("string");
    }
  });

  it("each descriptor has hasSubcommands boolean", () => {
    for (const d of CORE_CLI_COMMAND_DESCRIPTORS) {
      expect(typeof d.hasSubcommands).toBe("boolean");
    }
  });
});

describe("getCoreCliCommandDescriptors()", () => {
  it("returns same array as constant", () => {
    expect(getCoreCliCommandDescriptors()).toBe(CORE_CLI_COMMAND_DESCRIPTORS);
  });
});

describe("getCoreCliCommandsWithSubcommands()", () => {
  it("returns an array", () => {
    expect(Array.isArray(getCoreCliCommandsWithSubcommands())).toBe(true);
  });

  it("all entries are strings", () => {
    for (const name of getCoreCliCommandsWithSubcommands()) {
      expect(typeof name).toBe("string");
    }
  });

  it("returns subset of descriptor names", () => {
    const names = CORE_CLI_COMMAND_DESCRIPTORS.map((d) => d.name);
    for (const name of getCoreCliCommandsWithSubcommands()) {
      expect(names).toContain(name);
    }
  });
});
