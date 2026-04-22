import { describe, expect, it } from "vitest";
import { computeBaseConfigSchemaResponse } from "./schema-base.js";

describe("computeBaseConfigSchemaResponse()", () => {
  it("is a function", () => {
    expect(typeof computeBaseConfigSchemaResponse).toBe("function");
  });

  it("returns a non-null object", () => {
    const result = computeBaseConfigSchemaResponse();
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("returns object with schema field", () => {
    const result = computeBaseConfigSchemaResponse();
    expect("schema" in result).toBe(true);
  });

  it("returns object with version field", () => {
    const result = computeBaseConfigSchemaResponse();
    expect(typeof result.version).toBe("string");
  });

  it("returns object with generatedAt field", () => {
    const result = computeBaseConfigSchemaResponse();
    expect(typeof result.generatedAt).toBe("string");
  });

  it("returns object with uiHints field", () => {
    const result = computeBaseConfigSchemaResponse();
    expect("uiHints" in result).toBe(true);
  });

  it("does not throw with empty params", () => {
    expect(() => computeBaseConfigSchemaResponse({})).not.toThrow();
  });
});
