/**
 * src/config/zod-schema.providers.test.ts
 *
 * CoreBlow — Providers Schema Re-export + ChannelsSchema Tests
 * Verifies ChannelsSchema accepts valid channel configuration
 * and the providers schema module re-exports correctly.
 */
import { describe, expect, it } from "vitest";
import { ChannelsSchema } from "./zod-schema.providers.js";

describe("ChannelsSchema", () => {
  it("accepts undefined (optional)", () => {
    expect(ChannelsSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(ChannelsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts object with telegram key", () => {
    expect(
      ChannelsSchema.safeParse({ telegram: {} }).success,
    ).toBe(true);
  });

  it("accepts object with discord key", () => {
    expect(
      ChannelsSchema.safeParse({ discord: {} }).success,
    ).toBe(true);
  });

  it("accepts object with slack key", () => {
    expect(
      ChannelsSchema.safeParse({ slack: {} }).success,
    ).toBe(true);
  });

  it("does not throw during parse of null", () => {
    expect(() => ChannelsSchema.safeParse(null)).not.toThrow();
  });

  it("returns a result with success field", () => {
    const result = ChannelsSchema.safeParse({});
    expect("success" in result).toBe(true);
  });
});
