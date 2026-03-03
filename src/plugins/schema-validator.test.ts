import { describe, expect, it } from "vitest";
import { validateJsonSchemaValue } from "./schema-validator.js";

describe("schema validator", () => {
  it("validates a conforming value against a simple schema", () => {
    const result = validateJsonSchemaValue({
      schema: { type: "object", properties: { name: { type: "string" } } },
      cacheKey: "test-valid",
      value: { name: "CoreBlow" },
    });
    expect(result.ok).toBe(true);
  });

  it("detects type mismatches", () => {
    const result = validateJsonSchemaValue({
      schema: {
        type: "object",
        properties: { count: { type: "number" } },
        additionalProperties: false,
      },
      cacheKey: "test-mismatch",
      value: { count: "not-a-number" },
    });
    expect(result.ok).toBe(false);
  });
});
