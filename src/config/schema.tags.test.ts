import { describe, expect, it } from "vitest";
import { CONFIG_TAGS } from "./schema.tags.js";

describe("CONFIG_TAGS", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(CONFIG_TAGS)).toBe(true);
    expect(CONFIG_TAGS.length).toBeGreaterThan(0);
  });

  it("contains security tag", () => {
    expect(CONFIG_TAGS).toContain("security");
  });

  it("contains auth tag", () => {
    expect(CONFIG_TAGS).toContain("auth");
  });

  it("contains network tag", () => {
    expect(CONFIG_TAGS).toContain("network");
  });

  it("contains models tag", () => {
    expect(CONFIG_TAGS).toContain("models");
  });

  it("contains channels tag", () => {
    expect(CONFIG_TAGS).toContain("channels");
  });

  it("contains tools tag", () => {
    expect(CONFIG_TAGS).toContain("tools");
  });

  it("all tags are non-empty strings", () => {
    for (const tag of CONFIG_TAGS) {
      expect(typeof tag).toBe("string");
      expect(tag.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate tags", () => {
    const unique = new Set(CONFIG_TAGS);
    expect(unique.size).toBe(CONFIG_TAGS.length);
  });

  it("all tags are lowercase", () => {
    for (const tag of CONFIG_TAGS) {
      expect(tag).toBe(tag.toLowerCase());
    }
  });
});
