import { describe, expect, it } from "vitest";
import {
  CHAT_SEND_SESSION_KEY_MAX_LENGTH,
  NonEmptyString,
} from "./primitives.js";

describe("CHAT_SEND_SESSION_KEY_MAX_LENGTH", () => {
  it("is a positive number", () => {
    expect(typeof CHAT_SEND_SESSION_KEY_MAX_LENGTH).toBe("number");
    expect(CHAT_SEND_SESSION_KEY_MAX_LENGTH).toBeGreaterThan(0);
  });

  it("equals 512", () => {
    expect(CHAT_SEND_SESSION_KEY_MAX_LENGTH).toBe(512);
  });
});

describe("NonEmptyString schema", () => {
  it("is a non-null object (TypeBox schema)", () => {
    expect(typeof NonEmptyString).toBe("object");
    expect(NonEmptyString).not.toBeNull();
  });

  it("has minLength constraint", () => {
    expect((NonEmptyString as unknown as Record<string, unknown>).minLength).toBe(1);
  });

  it("is of type 'string'", () => {
    expect((NonEmptyString as unknown as Record<string, unknown>).type).toBe("string");
  });
});
