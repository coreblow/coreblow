import { describe, expect, it } from "vitest";
import { truncateCloseReason } from "./close-reason.js";

describe("truncateCloseReason()", () => {
  it("returns 'invalid handshake' for empty string", () => {
    expect(truncateCloseReason("")).toBe("invalid handshake");
  });

  it("returns reason as-is when within limit", () => {
    const reason = "Connection refused";
    expect(truncateCloseReason(reason)).toBe(reason);
  });

  it("truncates reason exceeding default 120 bytes", () => {
    const long = "x".repeat(200);
    const result = truncateCloseReason(long);
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(120);
  });

  it("truncates to custom maxBytes", () => {
    const reason = "a".repeat(50);
    const result = truncateCloseReason(reason, 20);
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(20);
  });

  it("preserves short reason unchanged with custom limit", () => {
    expect(truncateCloseReason("ok", 100)).toBe("ok");
  });

  it("handles exactly 120-byte string without truncation", () => {
    const exact = "a".repeat(120);
    expect(truncateCloseReason(exact)).toBe(exact);
  });
});
