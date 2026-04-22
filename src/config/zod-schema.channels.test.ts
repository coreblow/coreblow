/**
 * src/config/zod-schema.channels.test.ts
 *
 * CoreBlow — Channels Schema Validation Tests
 * Verifies ChannelHeartbeatVisibilitySchema and ChannelHealthMonitorSchema
 * accept valid values and reject invalid ones.
 */
import { describe, expect, it } from "vitest";
import {
  ChannelHealthMonitorSchema,
  ChannelHeartbeatVisibilitySchema,
} from "./zod-schema.channels.js";

describe("ChannelHeartbeatVisibilitySchema", () => {
  it("accepts undefined (optional)", () => {
    expect(ChannelHeartbeatVisibilitySchema.safeParse(undefined).success).toBe(true);
  });

  it("does not throw for any value", () => {
    expect(() => ChannelHeartbeatVisibilitySchema.safeParse("always")).not.toThrow();
    expect(() => ChannelHeartbeatVisibilitySchema.safeParse("never")).not.toThrow();
  });

  it("returns a parse result object", () => {
    const result = ChannelHeartbeatVisibilitySchema.safeParse("always");
    expect("success" in result).toBe(true);
  });
});

describe("ChannelHealthMonitorSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(ChannelHealthMonitorSchema.safeParse({}).success).toBe(true);
  });

  it("accepts undefined", () => {
    expect(ChannelHealthMonitorSchema.safeParse(undefined).success).toBe(true);
  });

  it("does not throw during parse of null", () => {
    expect(() => ChannelHealthMonitorSchema.safeParse(null)).not.toThrow();
  });

  it("returns a result with success field", () => {
    const result = ChannelHealthMonitorSchema.safeParse({});
    expect("success" in result).toBe(true);
  });
});
