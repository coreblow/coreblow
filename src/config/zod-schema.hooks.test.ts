import { describe, expect, it } from "vitest";
import {
  HookMappingSchema,
  InternalHooksSchema,
} from "./zod-schema.hooks.js";

describe("HookMappingSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(HookMappingSchema.safeParse({}).success).toBe(true);
  });

  it("accepts mapping with id field", () => {
    expect(HookMappingSchema.safeParse({ id: "my-hook" }).success).toBe(true);
  });

  it("accepts mapping with action=wake", () => {
    expect(HookMappingSchema.safeParse({ action: "wake" }).success).toBe(true);
  });

  it("accepts mapping with action=agent", () => {
    expect(HookMappingSchema.safeParse({ action: "agent" }).success).toBe(true);
  });

  it("rejects invalid action value", () => {
    expect(HookMappingSchema.safeParse({ action: "invalid-action" }).success).toBe(false);
  });

  it("accepts wakeMode=now", () => {
    expect(HookMappingSchema.safeParse({ wakeMode: "now" }).success).toBe(true);
  });

  it("accepts wakeMode=next-heartbeat", () => {
    expect(HookMappingSchema.safeParse({ wakeMode: "next-heartbeat" }).success).toBe(true);
  });

  it("rejects invalid wakeMode", () => {
    expect(HookMappingSchema.safeParse({ wakeMode: "immediate" }).success).toBe(false);
  });

  it("accepts match with path field", () => {
    expect(
      HookMappingSchema.safeParse({ match: { path: "/webhook/hook" } }).success,
    ).toBe(true);
  });
});

describe("InternalHooksSchema", () => {
  it("accepts undefined", () => {
    expect(InternalHooksSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(InternalHooksSchema.safeParse({}).success).toBe(true);
  });

  it("does not throw during parse", () => {
    expect(() => InternalHooksSchema.safeParse(null)).not.toThrow();
  });
});
