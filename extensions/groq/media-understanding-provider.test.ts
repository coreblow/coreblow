/**
 * extensions/groq/media-understanding-provider.test.ts
 *
 * CoreBlow — Groq Extension Media Understanding Provider Tests
 * Verifies groqMediaUnderstandingProvider export shape.
 */
import { describe, expect, it } from "vitest";
import { groqMediaUnderstandingProvider } from "./media-understanding-provider.js";

describe("groqMediaUnderstandingProvider", () => {
  it("is a non-null object", () => {
    expect(typeof groqMediaUnderstandingProvider).toBe("object");
    expect(groqMediaUnderstandingProvider).not.toBeNull();
  });

  it("has an id field", () => {
    expect("id" in groqMediaUnderstandingProvider).toBe(true);
  });

  it("id contains groq branding", () => {
    const id = (groqMediaUnderstandingProvider as Record<string, unknown>).id as string;
    expect(typeof id).toBe("string");
    expect(id.toLowerCase()).toContain("groq");
  });

  it("has at least one method or function field", () => {
    const keys = Object.keys(groqMediaUnderstandingProvider);
    expect(keys.length).toBeGreaterThan(0);
  });
});
