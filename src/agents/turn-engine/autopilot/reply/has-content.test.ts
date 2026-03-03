import { describe, expect, it } from "vitest";
import { hasContent } from "./has-content.js";

describe("hasContent()", () => {
  it("returns true for non-empty text", () => {
    expect(hasContent({ text: "hello" })).toBe(true);
  });

  it("returns false for empty string text", () => {
    expect(hasContent({ text: "" })).toBe(false);
  });

  it("returns false for whitespace-only text", () => {
    expect(hasContent({ text: "   " })).toBe(false);
  });

  it("returns true for mediaUrl present", () => {
    expect(hasContent({ mediaUrl: "https://example.com/img.png" })).toBe(true);
  });

  it("returns true for non-empty mediaUrls array", () => {
    expect(hasContent({ mediaUrls: ["https://a.com/1.png"] })).toBe(true);
  });

  it("returns false for empty mediaUrls array", () => {
    expect(hasContent({ mediaUrls: [] })).toBe(false);
  });

  it("returns false for completely empty payload", () => {
    expect(hasContent({})).toBe(false);
  });

  it("returns true when text and mediaUrl both present", () => {
    expect(hasContent({ text: "hi", mediaUrl: "https://x.com/img.png" })).toBe(true);
  });
});
