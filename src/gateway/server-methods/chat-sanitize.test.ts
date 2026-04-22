/**
 * src/gateway/server-methods/chat-sanitize.test.ts
 *
 * CoreBlow — Chat Sanitize Tests
 * Verifies sanitizeChatInput and sanitizeChatSendMessageInput.
 */
import { describe, expect, it } from "vitest";
import { sanitizeChatInput, sanitizeChatSendMessageInput } from "./chat-sanitize.js";

describe("sanitizeChatInput()", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeChatInput("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeChatInput("Hello CoreBlow")).toBe("Hello CoreBlow");
  });

  it("redacts <script> tags", () => {
    const result = sanitizeChatInput('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("[redacted script]");
  });

  it("preserves non-dangerous HTML text", () => {
    const input = "Use <b>bold</b> text";
    expect(sanitizeChatInput(input)).toContain("bold");
  });
});

describe("sanitizeChatSendMessageInput()", () => {
  it("returns ok=true for valid message", () => {
    const r = sanitizeChatSendMessageInput("Hello CoreBlow!");
    expect(r.ok).toBe(true);
    expect(r.sanitized).toBeTruthy();
  });

  it("returns ok=false for empty string", () => {
    const r = sanitizeChatSendMessageInput("");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("returns ok=false for whitespace-only", () => {
    const r = sanitizeChatSendMessageInput("   ");
    expect(r.ok).toBe(false);
  });

  it("returns ok=false for message exceeding 128k chars", () => {
    const r = sanitizeChatSendMessageInput("x".repeat(130_000));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("maximum length");
  });

  it("returns error for non-string input", () => {
    const r = sanitizeChatSendMessageInput(42 as never);
    expect(r.ok).toBe(false);
  });

  it("trims message before validation", () => {
    const r = sanitizeChatSendMessageInput("  hi  ");
    expect(r.ok).toBe(true);
  });
});
