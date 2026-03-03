import { describe, expect, it } from "vitest";
import {
  ElevatedAllowFromSchema,
  ToolPolicySchema,
} from "./zod-schema.agent-runtime.js";

describe("ElevatedAllowFromSchema", () => {
  it("accepts undefined (optional field)", () => {
    expect(ElevatedAllowFromSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty record", () => {
    expect(ElevatedAllowFromSchema.safeParse({}).success).toBe(true);
  });

  it("accepts record with string-array values", () => {
    expect(
      ElevatedAllowFromSchema.safeParse({ "user-id": ["channel-1", "channel-2"] }).success,
    ).toBe(true);
  });

  it("accepts record with number-array values", () => {
    expect(
      ElevatedAllowFromSchema.safeParse({ "user-id": [123, 456] }).success,
    ).toBe(true);
  });

  it("accepts mixed string/number array values", () => {
    expect(
      ElevatedAllowFromSchema.safeParse({ "user-id": ["chan-1", 42] }).success,
    ).toBe(true);
  });

  it("rejects array at top level (must be record)", () => {
    expect(ElevatedAllowFromSchema.safeParse(["user-id"]).success).toBe(false);
  });

  it("rejects string at top level", () => {
    expect(ElevatedAllowFromSchema.safeParse("all").success).toBe(false);
  });
});

describe("ToolPolicySchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(ToolPolicySchema.safeParse({}).success).toBe(true);
  });

  it("accepts undefined", () => {
    expect(ToolPolicySchema.safeParse(undefined).success).toBe(true);
  });

  it("does not throw during parse", () => {
    expect(() => ToolPolicySchema.safeParse({ enabled: true })).not.toThrow();
  });
});
