import { describe, expect, it } from "vitest";
import { PushTestParamsSchema, PushTestResultSchema } from "./push.js";

describe("PushTestParamsSchema", () => {
  it("is a non-null object", () => {
    expect(typeof PushTestParamsSchema).toBe("object");
    expect(PushTestParamsSchema).not.toBeNull();
  });

  it("has type object", () => {
    expect((PushTestParamsSchema as unknown as Record<string, unknown>).type).toBe("object");
  });
});

describe("PushTestResultSchema", () => {
  it("is a non-null object", () => {
    expect(typeof PushTestResultSchema).toBe("object");
    expect(PushTestResultSchema).not.toBeNull();
  });

  it("has type object", () => {
    expect((PushTestResultSchema as unknown as Record<string, unknown>).type).toBe("object");
  });
});
