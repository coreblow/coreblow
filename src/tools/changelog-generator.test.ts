/**
 * src/tools/changelog-generator.test.ts
 *
 * CoreBlow — Changelog Generator Tests
 * Verifies ChangelogGenerator: add, generateMarkdown, generateJSON,
 * getLatest, count, and version ordering.
 */
import { describe, beforeEach, expect, it } from "vitest";
import { ChangelogGenerator } from "./changelog-generator.js";

let gen: ChangelogGenerator;

beforeEach(() => {
  gen = new ChangelogGenerator();
});

describe("ChangelogGenerator — add()", () => {
  it("increments count", () => {
    gen.addEntry({ version: "1.0.0", date: "2025-01-01", categories: { added: ["Initial release"] } });
    expect(gen.count()).toBe(1);
  });

  it("accepts multiple entries", () => {
    gen.addEntry({ version: "1.0.0", date: "2025-01-01", categories: { added: ["v1"] } });
    gen.addEntry({ version: "1.1.0", date: "2025-02-01", categories: { changed: ["Update"] } });
    expect(gen.count()).toBe(2);
  });
});

describe("ChangelogGenerator — generateMarkdown()", () => {
  beforeEach(() => {
    gen.addEntry({ version: "1.0.0", date: "2025-01-01", categories: { added: ["Feature A"] } });
    gen.addEntry({ version: "1.1.0", date: "2025-02-01", categories: { fixed: ["Bug B"] } });
  });

  it("returns a non-empty string", () => {
    const md = gen.generateMarkdown();
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(0);
  });

  it("contains version numbers", () => {
    const md = gen.generateMarkdown();
    expect(md).toContain("1.0.0");
    expect(md).toContain("1.1.0");
  });

  it("contains category content", () => {
    const md = gen.generateMarkdown();
    expect(md).toContain("Feature A");
  });
});

describe("ChangelogGenerator — generateJSON()", () => {
  it("returns valid JSON string", () => {
    gen.addEntry({ version: "1.0.0", date: "2025-01-01", categories: { added: ["x"] } });
    const json = gen.generateJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("parsed JSON contains version entry", () => {
    gen.addEntry({ version: "1.0.0", date: "2025-01-01", categories: {} });
    const parsed = JSON.parse(gen.generateJSON()) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
  });
});

describe("ChangelogGenerator — getLatest()", () => {
  it("returns null when empty", () => {
    expect(gen.getLatest()).toBeNull();
  });

  it("returns the highest semantic version", () => {
    gen.addEntry({ version: "1.0.0", date: "2025-01-01", categories: {} });
    gen.addEntry({ version: "2.0.0", date: "2025-03-01", categories: {} });
    gen.addEntry({ version: "1.5.0", date: "2025-02-01", categories: {} });
    expect(gen.getLatest()?.version).toBe("2.0.0");
  });
});
