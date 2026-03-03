import { describe, expect, it } from "vitest";
import { ErrorCodes, errorShape } from "./error-codes.js";

describe("ErrorCodes constants", () => {
  it("is a non-null object", () => {
    expect(typeof ErrorCodes).toBe("object");
    expect(ErrorCodes).not.toBeNull();
  });

  it("contains NOT_LINKED", () => {
    expect(ErrorCodes.NOT_LINKED).toBe("NOT_LINKED");
  });

  it("contains NOT_PAIRED", () => {
    expect(ErrorCodes.NOT_PAIRED).toBe("NOT_PAIRED");
  });

  it("contains AGENT_TIMEOUT", () => {
    expect(ErrorCodes.AGENT_TIMEOUT).toBe("AGENT_TIMEOUT");
  });

  it("contains INVALID_REQUEST", () => {
    expect(ErrorCodes.INVALID_REQUEST).toBe("INVALID_REQUEST");
  });

  it("contains UNAVAILABLE", () => {
    expect(ErrorCodes.UNAVAILABLE).toBe("UNAVAILABLE");
  });

  it("all values are non-empty strings", () => {
    for (const val of Object.values(ErrorCodes)) {
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

describe("errorShape()", () => {
  it("returns an object with code and message", () => {
    const shape = errorShape("NOT_LINKED", "Device not linked");
    expect(shape.code).toBe("NOT_LINKED");
    expect(shape.message).toBe("Device not linked");
  });

  it("includes retryable when provided", () => {
    const shape = errorShape("UNAVAILABLE", "Service down", { retryable: true });
    expect(shape.retryable).toBe(true);
  });

  it("includes retryAfterMs when provided", () => {
    const shape = errorShape("UNAVAILABLE", "Rate limited", { retryAfterMs: 5000 });
    expect(shape.retryAfterMs).toBe(5000);
  });

  it("does not include optional fields when omitted", () => {
    const shape = errorShape("INVALID_REQUEST", "Bad input");
    expect(shape.retryable).toBeUndefined();
    expect(shape.retryAfterMs).toBeUndefined();
  });
});
