import { describe, expect, it } from "vitest";
import { coerceIdentityValue } from "./assistant-identity-values.js";

describe("coerceIdentityValue", () => {
  it("returns undefined for non-string or blank inputs", () => {
    expect(coerceIdentityValue(undefined, 10)).toBeUndefined();
    expect(coerceIdentityValue("   ", 10)).toBeUndefined();
    expect(coerceIdentityValue(42 as unknown as string, 10)).toBeUndefined();
  });

  it("trims whitespace and returns string within max length", () => {
    expect(coerceIdentityValue("  CoreBlow  ", 20)).toBe("CoreBlow");
    expect(coerceIdentityValue("  CoreBlow  ", 8)).toBe("CoreBlow");
  });

  it("truncates at exact max length boundary", () => {
    expect(coerceIdentityValue("  CoreBlow Agent  ", 8)).toBe("CoreBlow");
  });

  it("handles zero and negative max length", () => {
    expect(coerceIdentityValue("  CoreBlow  ", 0)).toBe("");
    expect(coerceIdentityValue("  CoreBlow  ", -1)).toBe("CoreBlo");
  });
});
