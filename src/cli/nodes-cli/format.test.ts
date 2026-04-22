/**
 * src/cli/nodes-cli/format.test.ts
 *
 * CoreBlow — Nodes CLI Format Tests
 * Verifies formatPermissions.
 */
import { describe, expect, it } from "vitest";
import { formatPermissions } from "./format.js";

describe("formatPermissions()", () => {
  it("returns null for null input", () => {
    expect(formatPermissions(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatPermissions(undefined)).toBeNull();
  });

  it("returns null for array input", () => {
    expect(formatPermissions(["read"])).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(formatPermissions({})).toBeNull();
  });

  it("returns formatted string for single permission", () => {
    const result = formatPermissions({ read: true });
    expect(typeof result).toBe("string");
    expect(result).toContain("read=yes");
  });

  it("formats false permissions as 'no'", () => {
    const result = formatPermissions({ write: false });
    expect(result).toContain("write=no");
  });

  it("wraps in brackets", () => {
    const result = formatPermissions({ read: true });
    expect(result?.startsWith("[")).toBe(true);
    expect(result?.endsWith("]")).toBe(true);
  });

  it("sorts permissions alphabetically", () => {
    const result = formatPermissions({ write: true, execute: false, read: true });
    const idx_exec = result!.indexOf("execute");
    const idx_read = result!.indexOf("read");
    const idx_write = result!.indexOf("write");
    expect(idx_exec).toBeLessThan(idx_read);
    expect(idx_read).toBeLessThan(idx_write);
  });
});
