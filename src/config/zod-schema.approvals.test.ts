import { describe, expect, it } from "vitest";
import { ApprovalsSchema } from "./zod-schema.approvals.js";

describe("ApprovalsSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(ApprovalsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts undefined exec field", () => {
    expect(ApprovalsSchema.safeParse({ exec: undefined }).success).toBe(true);
  });

  it("accepts exec with enabled=true", () => {
    expect(ApprovalsSchema.safeParse({ exec: { enabled: true } }).success).toBe(true);
  });

  it("accepts exec with mode=session", () => {
    expect(
      ApprovalsSchema.safeParse({ exec: { mode: "session" } }).success,
    ).toBe(true);
  });

  it("accepts exec with mode=targets", () => {
    expect(
      ApprovalsSchema.safeParse({ exec: { mode: "targets" } }).success,
    ).toBe(true);
  });

  it("accepts exec with mode=both", () => {
    expect(
      ApprovalsSchema.safeParse({ exec: { mode: "both" } }).success,
    ).toBe(true);
  });

  it("rejects exec with invalid mode", () => {
    expect(
      ApprovalsSchema.safeParse({ exec: { mode: "always" } }).success,
    ).toBe(false);
  });

  it("accepts exec with valid target", () => {
    expect(
      ApprovalsSchema.safeParse({
        exec: {
          targets: [{ channel: "discord", to: "user-id" }],
        },
      }).success,
    ).toBe(true);
  });

  it("rejects target missing required 'channel' field", () => {
    expect(
      ApprovalsSchema.safeParse({
        exec: {
          targets: [{ to: "user-id" }],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects target missing required 'to' field", () => {
    expect(
      ApprovalsSchema.safeParse({
        exec: {
          targets: [{ channel: "discord" }],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    expect(
      ApprovalsSchema.safeParse({ unknownField: true }).success,
    ).toBe(false);
  });
});
