import { describe, expect, it } from "vitest";
import { createAllowDenyChannelRulesSchema } from "./zod-schema.allowdeny.js";

const AllowDenySchema = createAllowDenyChannelRulesSchema();

describe("createAllowDenyChannelRulesSchema", () => {
  it("accepts undefined (entire field optional)", () => {
    expect(AllowDenySchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(AllowDenySchema.safeParse({}).success).toBe(true);
  });

  it("accepts object with default=allow", () => {
    expect(AllowDenySchema.safeParse({ default: "allow" }).success).toBe(true);
  });

  it("accepts object with default=deny", () => {
    expect(AllowDenySchema.safeParse({ default: "deny" }).success).toBe(true);
  });

  it("rejects invalid default action", () => {
    expect(AllowDenySchema.safeParse({ default: "permit" }).success).toBe(false);
  });

  it("accepts valid rule with action allow", () => {
    expect(
      AllowDenySchema.safeParse({
        rules: [{ action: "allow", match: { channel: "discord:123" } }],
      }).success,
    ).toBe(true);
  });

  it("accepts valid rule with chatType direct", () => {
    expect(
      AllowDenySchema.safeParse({
        rules: [{ action: "deny", match: { chatType: "direct" } }],
      }).success,
    ).toBe(true);
  });

  it("accepts deprecated chatType dm", () => {
    expect(
      AllowDenySchema.safeParse({
        rules: [{ action: "allow", match: { chatType: "dm" } }],
      }).success,
    ).toBe(true);
  });

  it("rejects invalid chatType", () => {
    expect(
      AllowDenySchema.safeParse({
        rules: [{ action: "allow", match: { chatType: "private" } }],
      }).success,
    ).toBe(false);
  });

  it("rejects rule without action field", () => {
    expect(
      AllowDenySchema.safeParse({
        rules: [{ match: { channel: "abc" } }],
      }).success,
    ).toBe(false);
  });

  it("rejects extra fields in rule object (strict)", () => {
    expect(
      AllowDenySchema.safeParse({
        rules: [{ action: "allow", unknownField: true }],
      }).success,
    ).toBe(false);
  });
});
