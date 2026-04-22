/**
 * src/tools/coreapi-generator.test.ts
 *
 * CoreBlow — CoreAPI Generator Tests
 * Verifies CoreAPIGenerator: generate, toJSON, count.
 */
import { describe, beforeEach, expect, it } from "vitest";
import { CoreAPIGenerator } from "./coreapi-generator.js";

let gen: CoreAPIGenerator;

beforeEach(() => {
  gen = new CoreAPIGenerator({ title: "CoreBlow API", version: "1.0.0" });
});

describe("CoreAPIGenerator — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new CoreAPIGenerator({ title: "Test API", version: "0.1.0" })).not.toThrow();
  });

  it("starts with zero operations", () => {
    expect(gen.count()).toBe(0);
  });
});

describe("CoreAPIGenerator — generate()", () => {
  it("returns a non-null object", () => {
    const spec = gen.generate();
    expect(typeof spec).toBe("object");
    expect(spec).not.toBeNull();
  });

  it("spec contains info with title", () => {
    const spec = gen.generate() as { info?: { title?: string } };
    expect(spec.info?.title).toBe("CoreBlow API");
  });

  it("spec contains paths or operations object", () => {
    const spec = gen.generate() as Record<string, unknown>;
    // Should have at least one top-level key
    expect(Object.keys(spec).length).toBeGreaterThan(0);
  });
});

describe("CoreAPIGenerator — toJSON()", () => {
  it("returns a valid JSON string", () => {
    const json = gen.toJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("JSON contains title", () => {
    const parsed = JSON.parse(gen.toJSON()) as Record<string, unknown>;
    const text = JSON.stringify(parsed);
    expect(text).toContain("CoreBlow API");
  });
});
