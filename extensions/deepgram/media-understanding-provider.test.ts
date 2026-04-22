/**
 * extensions/deepgram/media-understanding-provider.test.ts
 *
 * CoreBlow — Deepgram Extension Media Understanding Provider Tests
 */
import { describe, expect, it } from "vitest";
import { deepgramMediaUnderstandingProvider } from "./media-understanding-provider.js";

describe("deepgramMediaUnderstandingProvider", () => {
  it("is a non-null object", () => {
    expect(typeof deepgramMediaUnderstandingProvider).toBe("object");
    expect(deepgramMediaUnderstandingProvider).not.toBeNull();
  });

  it("has an id field", () => {
    expect("id" in deepgramMediaUnderstandingProvider).toBe(true);
  });

  it("id is a non-empty string", () => {
    const id = (deepgramMediaUnderstandingProvider as Record<string, unknown>).id as string;
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("has at least one key", () => {
    expect(Object.keys(deepgramMediaUnderstandingProvider).length).toBeGreaterThan(0);
  });
});
