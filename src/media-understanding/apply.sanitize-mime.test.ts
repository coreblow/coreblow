import { describe, expect, it } from "vitest";
import { sanitizeMimeType } from "./apply.js";

describe("sanitizeMimeType", () => {
  it("normalizes valid MIME values and rejects injected values", () => {
    expect(sanitizeMimeType("  IMAGE/PNG; charset=utf-8  ")).toBe("image/png");
    expect(sanitizeMimeType("image/png\nx-injected: yes")).toBeUndefined();
    expect(sanitizeMimeType("image/png;")).toBeUndefined();
  });
});
