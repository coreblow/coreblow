import { describe, expect, it } from "vitest";
import { AgentModelSchema } from "./zod-schema.agent-model.js";

describe("AgentModelSchema", () => {
  it("accepts a plain string model", () => {
    expect(AgentModelSchema.safeParse("gpt-4o").success).toBe(true);
  });

  it("accepts empty string (schema allows any string)", () => {
    expect(AgentModelSchema.safeParse("").success).toBe(true);
  });

  it("accepts object with primary only", () => {
    expect(AgentModelSchema.safeParse({ primary: "gpt-4o" }).success).toBe(true);
  });

  it("accepts object with primary and fallbacks", () => {
    expect(
      AgentModelSchema.safeParse({ primary: "gpt-4o", fallbacks: ["gpt-4", "claude-2"] })
        .success,
    ).toBe(true);
  });

  it("accepts object with fallbacks only (primary optional)", () => {
    expect(AgentModelSchema.safeParse({ fallbacks: ["gpt-4"] }).success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    expect(AgentModelSchema.safeParse({}).success).toBe(true);
  });

  it("rejects object with unknown extra fields (strict mode)", () => {
    expect(
      AgentModelSchema.safeParse({ primary: "gpt-4o", unknownField: true }).success,
    ).toBe(false);
  });

  it("rejects number input", () => {
    expect(AgentModelSchema.safeParse(42).success).toBe(false);
  });

  it("rejects null", () => {
    expect(AgentModelSchema.safeParse(null).success).toBe(false);
  });

  it("rejects array", () => {
    expect(AgentModelSchema.safeParse(["gpt-4o"]).success).toBe(false);
  });
});
