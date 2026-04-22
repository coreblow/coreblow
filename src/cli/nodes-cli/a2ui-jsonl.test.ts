/**
 * src/cli/nodes-cli/a2ui-jsonl.test.ts
 *
 * CoreBlow — A2UI JSONL Tests
 * Verifies buildA2UITextJsonl (returns string) and validateA2UIJsonl (throws on invalid).
 */
import { describe, expect, it } from "vitest";
import { buildA2UITextJsonl, validateA2UIJsonl } from "./a2ui-jsonl.js";

describe("buildA2UITextJsonl()", () => {
  it("returns a string", () => {
    const result = buildA2UITextJsonl("Hello CoreBlow");
    expect(typeof result).toBe("string");
  });

  it("returns non-empty string", () => {
    const result = buildA2UITextJsonl("test");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains JSON-parseable lines", () => {
    const result = buildA2UITextJsonl("Hello");
    const lines = result.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("does not throw for any string input", () => {
    expect(() => buildA2UITextJsonl("")).not.toThrow();
    expect(() => buildA2UITextJsonl("CoreBlow rocks!")).not.toThrow();
  });
});

describe("validateA2UIJsonl()", () => {
  it("is a function", () => {
    expect(typeof validateA2UIJsonl).toBe("function");
  });

  it("throws for empty string (invalid JSONL)", () => {
    expect(() => validateA2UIJsonl("")).toThrow();
  });

  it("does not throw for output of buildA2UITextJsonl", () => {
    const validJsonl = buildA2UITextJsonl("Hello CoreBlow");
    expect(() => validateA2UIJsonl(validJsonl)).not.toThrow();
  });

  it("throws for malformed JSON lines", () => {
    expect(() => validateA2UIJsonl("not-json\nnot-json")).toThrow();
  });
});
