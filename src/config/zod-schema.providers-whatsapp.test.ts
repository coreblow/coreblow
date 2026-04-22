/**
 * src/config/zod-schema.providers-whatsapp.test.ts
 *
 * CoreBlow — WhatsApp Provider Schema Validation Tests
 * Verifies WhatsAppAccountSchema and WhatsAppConfigSchema
 * accept valid WhatsApp configuration shapes.
 */
import { describe, expect, it } from "vitest";
import {
  WhatsAppAccountSchema,
  WhatsAppConfigSchema,
} from "./zod-schema.providers-whatsapp.js";

describe("WhatsAppAccountSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(WhatsAppAccountSchema.safeParse({}).success).toBe(true);
  });

  it("accepts object with enabled=true", () => {
    expect(WhatsAppAccountSchema.safeParse({ enabled: true }).success).toBe(true);
  });

  it("accepts object with enabled=false", () => {
    expect(WhatsAppAccountSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it("does not throw during parse", () => {
    expect(() => WhatsAppAccountSchema.safeParse({})).not.toThrow();
  });

  it("returns a result with success field", () => {
    const result = WhatsAppAccountSchema.safeParse({});
    expect("success" in result).toBe(true);
  });
});

describe("WhatsAppConfigSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(WhatsAppConfigSchema.safeParse({}).success).toBe(true);
  });

  it("accepts object with enabled=true", () => {
    expect(WhatsAppConfigSchema.safeParse({ enabled: true }).success).toBe(true);
  });

  it("does not throw during parse", () => {
    expect(() => WhatsAppConfigSchema.safeParse({})).not.toThrow();
  });

  it("returns a result with success field", () => {
    const result = WhatsAppConfigSchema.safeParse({});
    expect("success" in result).toBe(true);
  });
});
