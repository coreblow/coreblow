/**
 * src/cli/shared/parse-port.test.ts
 *
 * CoreBlow — CLI Parse Port Tests
 * Verifies parsePort: null for invalid, number for valid.
 */
import { describe, expect, it } from "vitest";
import { parsePort } from "./parse-port.js";

describe("parsePort()", () => {
  it("returns null for undefined", () => {
    expect(parsePort(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parsePort(null)).toBeNull();
  });

  it("returns null for 0 (not positive)", () => {
    expect(parsePort(0)).toBeNull();
  });

  it("returns null for negative number", () => {
    expect(parsePort(-1)).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parsePort("abc")).toBeNull();
  });

  it("returns 8080 for numeric string '8080'", () => {
    expect(parsePort("8080")).toBe(8080);
  });

  it("returns 3000 for number 3000", () => {
    expect(parsePort(3000)).toBe(3000);
  });

  it("returns null for decimal number", () => {
    expect(parsePort(3.14)).toBeNull();
  });
});
