import { describe, expect, it } from "vitest";
import { readCliBannerTaglineMode } from "./banner-config-lite.js";

describe("readCliBannerTaglineMode()", () => {
  it("is a function", () => {
    expect(typeof readCliBannerTaglineMode).toBe("function");
  });

  it("does not throw with empty env", () => {
    expect(() => readCliBannerTaglineMode({})).not.toThrow();
  });

  it("returns undefined or string for empty env", () => {
    const result = readCliBannerTaglineMode({});
    expect(result === undefined || typeof result === "string").toBe(true);
  });

  it("returns undefined when config loading fails", () => {
    // Non-existent config path — should silently return undefined
    const result = readCliBannerTaglineMode({ HOME: "/nonexistent/path" });
    expect(result).toBeUndefined();
  });
});
