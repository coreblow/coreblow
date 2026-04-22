/**
 * src/gateway/control-ui-shared.test.ts
 *
 * CoreBlow — Gateway Control UI Shared Tests
 * Verifies normalizeControlUiBasePath and buildControlUiAvatarUrl.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeControlUiBasePath,
  buildControlUiAvatarUrl,
} from "./control-ui-shared.js";

describe("normalizeControlUiBasePath()", () => {
  it("returns empty string for undefined", () => {
    expect(normalizeControlUiBasePath(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeControlUiBasePath("")).toBe("");
  });

  it("returns empty string for whitespace-only", () => {
    expect(normalizeControlUiBasePath("   ")).toBe("");
  });

  it("prepends slash if missing", () => {
    const result = normalizeControlUiBasePath("admin");
    expect(result.startsWith("/")).toBe(true);
  });

  it("preserves leading slash", () => {
    expect(normalizeControlUiBasePath("/admin")).toBe("/admin");
  });

  it("strips trailing slash", () => {
    const result = normalizeControlUiBasePath("/admin/");
    expect(result.endsWith("/")).toBe(false);
  });
});

describe("buildControlUiAvatarUrl()", () => {
  it("returns path without basePath", () => {
    const result = buildControlUiAvatarUrl("", "agent-1");
    expect(result).toContain("agent-1");
  });

  it("includes basePath when provided", () => {
    const result = buildControlUiAvatarUrl("/admin", "agent-1");
    expect(result.startsWith("/admin")).toBe(true);
    expect(result).toContain("agent-1");
  });

  it("returns a string", () => {
    expect(typeof buildControlUiAvatarUrl("/ui", "a1")).toBe("string");
  });
});
