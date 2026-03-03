import { describe, expect, it } from "vitest";
import {
  AgentsSchema,
  BroadcastSchema,
  BroadcastStrategySchema,
} from "./zod-schema.agents.js";

describe("BroadcastStrategySchema", () => {
  it("accepts parallel", () => {
    expect(BroadcastStrategySchema.safeParse("parallel").success).toBe(true);
  });

  it("accepts sequential", () => {
    expect(BroadcastStrategySchema.safeParse("sequential").success).toBe(true);
  });

  it("rejects unknown strategy", () => {
    expect(BroadcastStrategySchema.safeParse("concurrent").success).toBe(false);
  });

  it("rejects number", () => {
    expect(BroadcastStrategySchema.safeParse(1).success).toBe(false);
  });
});

describe("BroadcastSchema", () => {
  it("accepts undefined (optional)", () => {
    expect(BroadcastSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(BroadcastSchema.safeParse({}).success).toBe(true);
  });

  it("accepts object with strategy=parallel", () => {
    expect(BroadcastSchema.safeParse({ strategy: "parallel" }).success).toBe(true);
  });

  it("rejects invalid strategy value", () => {
    expect(BroadcastSchema.safeParse({ strategy: "random" }).success).toBe(false);
  });
});

describe("AgentsSchema", () => {
  it("accepts undefined (optional)", () => {
    expect(AgentsSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(AgentsSchema.safeParse({}).success).toBe(true);
  });

  it("does not throw for arbitrary agent config", () => {
    expect(() =>
      AgentsSchema.safeParse({ "my-agent": { model: "gpt-4o" } }),
    ).not.toThrow();
  });
});
