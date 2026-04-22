/**
 * src/cli/help-format.test.ts
 *
 * CoreBlow — Help Format Tests
 * Verifies formatHelpExample, formatHelpExampleLine, formatHelpExamples.
 */
import { describe, expect, it } from "vitest";
import {
  formatHelpExample,
  formatHelpExampleLine,
  formatHelpExamples,
} from "./help-format.js";

describe("formatHelpExample()", () => {
  it("returns a string", () => {
    const result = formatHelpExample("coreblow start", "Start the daemon");
    expect(typeof result).toBe("string");
  });

  it("includes the command", () => {
    const result = formatHelpExample("coreblow start", "Start the daemon");
    expect(result).toContain("coreblow start");
  });

  it("includes the description", () => {
    const result = formatHelpExample("coreblow start", "Start the daemon");
    expect(result).toContain("Start the daemon");
  });

  it("works with empty description", () => {
    const result = formatHelpExample("coreblow help", "");
    expect(typeof result).toBe("string");
    expect(result).toContain("coreblow help");
  });
});

describe("formatHelpExampleLine()", () => {
  it("returns a string", () => {
    const result = formatHelpExampleLine("coreblow run", "Run agent");
    expect(typeof result).toBe("string");
  });
});

describe("formatHelpExamples()", () => {
  it("returns empty string for empty array", () => {
    const result = formatHelpExamples([]);
    expect(result).toBe("");
  });

  it("returns a string for non-empty examples", () => {
    const result = formatHelpExamples([
      ["coreblow start", "Start daemon"] as const,
    ]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
