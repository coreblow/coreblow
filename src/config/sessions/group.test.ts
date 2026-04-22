/**
 * src/config/sessions/group.test.ts
 *
 * CoreBlow — Sessions Group Tests
 * Verifies buildGroupDisplayName.
 */
import { describe, expect, it } from "vitest";
import { buildGroupDisplayName } from "./group.js";

describe("buildGroupDisplayName()", () => {
  it("returns a string", () => {
    const result = buildGroupDisplayName({ key: "group-123" });
    expect(typeof result).toBe("string");
  });

  it("returns non-empty string", () => {
    const result = buildGroupDisplayName({ key: "group-123" });
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes provider when given", () => {
    const result = buildGroupDisplayName({ key: "g1", provider: "slack" });
    expect(result.toLowerCase()).toContain("slack");
  });

  it("includes normalized subject in output", () => {
    const result = buildGroupDisplayName({ key: "g1", subject: "Sales Team" });
    // Subject is normalized: 'Sales Team' → 'sales-team' fragment
    expect(result.toLowerCase()).toContain("sales");
  });

  it("does not throw for minimal params", () => {
    expect(() => buildGroupDisplayName({ key: "x" })).not.toThrow();
  });

  it("does not throw for all optional fields", () => {
    expect(() =>
      buildGroupDisplayName({
        key: "k",
        provider: "discord",
        subject: "team",
        groupChannel: "general",
        space: "workspace",
        id: "42",
      })
    ).not.toThrow();
  });
});
