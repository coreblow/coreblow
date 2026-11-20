import { describe, expect, it } from "vitest";
import { detectLightMode, inkLightPalette, inkDarkPalette } from "./theme.js";

describe("theme light/dark detection", () => {
  describe("explicit COREBLOW_THEME override", () => {
    it("returns true when COREBLOW_THEME=light", () => {
      expect(detectLightMode({ COREBLOW_THEME: "light" }, null)).toBe(true);
      expect(detectLightMode({ COREBLOW_THEME: "Light" }, "Dark")).toBe(true);
    });

    it("returns false when COREBLOW_THEME=dark", () => {
      expect(detectLightMode({ COREBLOW_THEME: "dark" }, "Light")).toBe(false);
      expect(detectLightMode({ COREBLOW_THEME: "DARK" }, null)).toBe(false);
    });
  });

  describe("COLORFGBG detection", () => {
    it("returns true for light backgrounds (bg=15 or bg=7)", () => {
      expect(detectLightMode({ COLORFGBG: "0;15" }, null)).toBe(true);
      expect(detectLightMode({ COLORFGBG: "0;7" }, null)).toBe(true);
    });

    it("returns true for 256-color light backgrounds (bg >= 244)", () => {
      expect(detectLightMode({ COLORFGBG: "0;250" }, null)).toBe(true);
      expect(detectLightMode({ COLORFGBG: "0;255" }, null)).toBe(true);
    });

    it("returns false for dark backgrounds (bg=0, bg=8, bg=232)", () => {
      expect(detectLightMode({ COLORFGBG: "15;0" }, "Light")).toBe(false);
      expect(detectLightMode({ COLORFGBG: "15;8" }, null)).toBe(false);
      expect(detectLightMode({ COLORFGBG: "15;232" }, null)).toBe(false);
    });
  });

  describe("macOS AppleInterfaceStyle fallback", () => {
    it("returns false when macOS appearance is Dark", () => {
      expect(detectLightMode({}, "Dark")).toBe(false);
      expect(detectLightMode({}, "dark")).toBe(false);
    });

    it("returns true when macOS appearance is Light", () => {
      expect(detectLightMode({}, "Light")).toBe(true);
      expect(detectLightMode({}, "")).toBe(true);
    });

    it("defaults to false on non-macOS when style is null", () => {
      expect(detectLightMode({}, null)).toBe(false);
    });
  });

  describe("palette contrast values", () => {
    it("has high-contrast primary text for light mode", () => {
      expect(inkLightPalette.text).toBe("#1C1917");
      expect(inkLightPalette.accent).toBe("#EA580C");
      expect(inkLightPalette.border).toBe("#D6D3D1");
    });

    it("has high-contrast primary text for dark mode", () => {
      expect(inkDarkPalette.text).toBe("#F5F5F4");
      expect(inkDarkPalette.accent).toBe("#F97316");
      expect(inkDarkPalette.border).toBe("#3F3F46");
    });
  });
});
