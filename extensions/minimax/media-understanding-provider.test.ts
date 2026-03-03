/**
 * extensions/minimax/media-understanding-provider.test.ts
 *
 * CoreBlow — Minimax Extension Media Understanding Provider Tests
 * Verifies minimaxMediaUnderstandingProvider and Portal variant shapes.
 */
import { describe, expect, it } from "vitest";
import {
  minimaxMediaUnderstandingProvider,
  minimaxPortalMediaUnderstandingProvider,
} from "./media-understanding-provider.js";

describe("minimaxMediaUnderstandingProvider", () => {
  it("is a non-null object", () => {
    expect(typeof minimaxMediaUnderstandingProvider).toBe("object");
    expect(minimaxMediaUnderstandingProvider).not.toBeNull();
  });

  it("has an id field", () => {
    expect("id" in minimaxMediaUnderstandingProvider).toBe(true);
  });

  it("id contains minimax branding", () => {
    const id = (minimaxMediaUnderstandingProvider as Record<string, unknown>).id as string;
    expect(id.toLowerCase()).toContain("minimax");
  });
});

describe("minimaxPortalMediaUnderstandingProvider", () => {
  it("is a non-null object", () => {
    expect(typeof minimaxPortalMediaUnderstandingProvider).toBe("object");
    expect(minimaxPortalMediaUnderstandingProvider).not.toBeNull();
  });

  it("has an id field", () => {
    expect("id" in minimaxPortalMediaUnderstandingProvider).toBe(true);
  });

  it("portal provider is distinct from main provider", () => {
    const mainId = (minimaxMediaUnderstandingProvider as Record<string, unknown>).id;
    const portalId = (minimaxPortalMediaUnderstandingProvider as Record<string, unknown>).id;
    expect(mainId).not.toBe(portalId);
  });
});
