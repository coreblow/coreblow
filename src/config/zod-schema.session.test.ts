import { describe, expect, it } from "vitest";
import {
  MessagesSchema,
  SessionSendPolicySchema,
  SessionSchema,
} from "./zod-schema.session.js";

describe("SessionSendPolicySchema", () => {
  it("accepts undefined (optional)", () => {
    expect(SessionSendPolicySchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(SessionSendPolicySchema.safeParse({}).success).toBe(true);
  });

  it("accepts default=allow", () => {
    expect(SessionSendPolicySchema.safeParse({ default: "allow" }).success).toBe(true);
  });

  it("rejects invalid default action", () => {
    expect(SessionSendPolicySchema.safeParse({ default: "permit" }).success).toBe(false);
  });
});

describe("SessionSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(SessionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts scope=per-sender", () => {
    expect(SessionSchema.safeParse({ scope: "per-sender" }).success).toBe(true);
  });

  it("accepts scope=global", () => {
    expect(SessionSchema.safeParse({ scope: "global" }).success).toBe(true);
  });

  it("rejects invalid scope", () => {
    expect(SessionSchema.safeParse({ scope: "user" }).success).toBe(false);
  });

  it("does not throw during parse of unknown shape", () => {
    expect(() => SessionSchema.safeParse({ unknownField: true })).not.toThrow();
  });
});

describe("MessagesSchema", () => {
  it("accepts undefined", () => {
    expect(MessagesSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(MessagesSchema.safeParse({}).success).toBe(true);
  });

  it("does not throw during parse", () => {
    expect(() => MessagesSchema.safeParse({})).not.toThrow();
  });
});
