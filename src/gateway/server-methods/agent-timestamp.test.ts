import { describe, expect, it } from "vitest";
import { injectTimestamp } from "./agent-timestamp.js";

describe("injectTimestamp()", () => {
  it("returns whitespace-only message unchanged", () => {
    expect(injectTimestamp("   ")).toBe("   ");
  });

  it("returns empty string unchanged", () => {
    expect(injectTimestamp("")).toBe("");
  });

  it("injects timestamp into plain message", () => {
    const result = injectTimestamp("Hello from CoreBlow");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan("Hello from CoreBlow".length);
  });

  it("does not double-inject timestamp if already present", () => {
    const once = injectTimestamp("Hello");
    const twice = injectTimestamp(once);
    expect(twice).toBe(once);
  });

  it("accepts custom now option", () => {
    const now = new Date("2025-01-15T12:00:00Z");
    const result = injectTimestamp("Test message", { now });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
