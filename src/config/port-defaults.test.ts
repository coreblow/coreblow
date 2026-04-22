import { describe, it, expect } from "vitest";
import {
  deriveDefaultBridgePort,
  deriveDefaultBrowserControlPort,
  deriveDefaultCanvasHostPort,
  deriveDefaultBrowserCdpPortRange,
  DEFAULT_BRIDGE_PORT,
  DEFAULT_BROWSER_CONTROL_PORT,
  DEFAULT_CANVAS_HOST_PORT,
  DEFAULT_BROWSER_CDP_PORT_RANGE_START,
  DEFAULT_BROWSER_CDP_PORT_RANGE_END,
} from "./port-defaults.js";

describe("port-defaults", () => {
  describe("deriveDefaultBridgePort", () => {
    it("derives bridge port from gateway port + 1", () => {
      expect(deriveDefaultBridgePort(18789)).toBe(18790);
      expect(deriveDefaultBridgePort(8080)).toBe(8081);
    });

    it("falls back to default when result is invalid", () => {
      expect(deriveDefaultBridgePort(65535)).toBe(DEFAULT_BRIDGE_PORT);
      expect(deriveDefaultBridgePort(-1)).toBe(DEFAULT_BRIDGE_PORT);
      expect(deriveDefaultBridgePort(NaN)).toBe(DEFAULT_BRIDGE_PORT);
    });
  });

  describe("deriveDefaultBrowserControlPort", () => {
    it("derives browser control port from gateway port + 2", () => {
      expect(deriveDefaultBrowserControlPort(18789)).toBe(18791);
      expect(deriveDefaultBrowserControlPort(9000)).toBe(9002);
    });

    it("falls back to default when result is invalid", () => {
      expect(deriveDefaultBrowserControlPort(65534)).toBe(DEFAULT_BROWSER_CONTROL_PORT);
    });
  });

  describe("deriveDefaultCanvasHostPort", () => {
    it("derives canvas host port from gateway port + 4", () => {
      expect(deriveDefaultCanvasHostPort(18789)).toBe(18793);
    });

    it("falls back to default for invalid port", () => {
      expect(deriveDefaultCanvasHostPort(65535)).toBe(DEFAULT_CANVAS_HOST_PORT);
    });
  });

  describe("deriveDefaultBrowserCdpPortRange", () => {
    it("derives CDP port range from browser control port + 9", () => {
      const range = deriveDefaultBrowserCdpPortRange(18791);
      expect(range.start).toBe(18800);
      expect(range.end).toBe(18899);
      expect(range.end).toBeGreaterThanOrEqual(range.start);
    });

    it("ensures end >= start even for edge cases", () => {
      const range = deriveDefaultBrowserCdpPortRange(65500);
      expect(range.end).toBeGreaterThanOrEqual(range.start);
    });

    it("uses default range constants", () => {
      expect(DEFAULT_BROWSER_CDP_PORT_RANGE_START).toBe(18800);
      expect(DEFAULT_BROWSER_CDP_PORT_RANGE_END).toBe(18899);
    });
  });
});
