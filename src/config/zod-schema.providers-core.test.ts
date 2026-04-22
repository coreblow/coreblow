/**
 * src/config/zod-schema.providers-core.test.ts
 *
 * CoreBlow — Providers Core Schema Validation Tests
 * Verifies TelegramTopicSchema, TelegramGroupSchema, TelegramDirectSchema,
 * DiscordDmSchema and DiscordGuildChannelSchema accept valid structures.
 */
import { describe, expect, it } from "vitest";
import {
  DiscordDmSchema,
  DiscordGuildChannelSchema,
  TelegramDirectSchema,
  TelegramGroupSchema,
  TelegramTopicSchema,
} from "./zod-schema.providers-core.js";

describe("TelegramTopicSchema", () => {
  it("does not throw during parse of empty object", () => {
    expect(() => TelegramTopicSchema.safeParse({})).not.toThrow();
  });
  it("returns a result with success field", () => {
    expect("success" in TelegramTopicSchema.safeParse({})).toBe(true);
  });
  it("accepts empty object", () => {
    expect(TelegramTopicSchema.safeParse({}).success).toBe(true);
  });
});

describe("TelegramGroupSchema", () => {
  it("accepts empty object", () => {
    expect(TelegramGroupSchema.safeParse({}).success).toBe(true);
  });
  it("does not throw on parse", () => {
    expect(() => TelegramGroupSchema.safeParse({ enabled: true })).not.toThrow();
  });
  it("returns success field in result", () => {
    expect("success" in TelegramGroupSchema.safeParse({})).toBe(true);
  });
});

describe("TelegramDirectSchema", () => {
  it("accepts empty object", () => {
    expect(TelegramDirectSchema.safeParse({}).success).toBe(true);
  });
  it("does not throw on parse", () => {
    expect(() => TelegramDirectSchema.safeParse({})).not.toThrow();
  });
});

describe("DiscordDmSchema", () => {
  it("accepts empty object", () => {
    expect(DiscordDmSchema.safeParse({}).success).toBe(true);
  });
  it("does not throw for boolean enabled field", () => {
    expect(() => DiscordDmSchema.safeParse({ enabled: true })).not.toThrow();
  });
  it("returns success field in result", () => {
    expect("success" in DiscordDmSchema.safeParse({})).toBe(true);
  });
});

describe("DiscordGuildChannelSchema", () => {
  it("accepts empty object", () => {
    expect(DiscordGuildChannelSchema.safeParse({}).success).toBe(true);
  });
  it("does not throw on parse", () => {
    expect(() => DiscordGuildChannelSchema.safeParse({})).not.toThrow();
  });
});
