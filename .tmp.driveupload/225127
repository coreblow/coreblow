import { describe, expect, it } from "vitest";
import { bindAbortRelay, buildTimeoutAbortSignal } from "./fetch-timeout.js";

describe("fetch-timeout", () => {
  describe("bindAbortRelay", () => {
    it("returns unbind function", () => {
      const controller = new AbortController();
      const unbind = bindAbortRelay(controller);
      expect(typeof unbind).toBe("function");
      unbind();
    });

    it("does not throw when controller is not aborted", () => {
      const controller = new AbortController();
      const unbind = bindAbortRelay(controller);
      expect(controller.signal.aborted).toBe(false);
      unbind();
    });
  });

  describe("buildTimeoutAbortSignal", () => {
    it("creates signal with timeout", () => {
      const result = buildTimeoutAbortSignal({ timeoutMs: 5000 });
      expect(result).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(result.signal!.aborted).toBe(false);
    });

    it("preserves external signal", () => {
      const external = new AbortController();
      const result = buildTimeoutAbortSignal({ timeoutMs: 5000, signal: external.signal });
      expect(result.signal).toBeDefined();
      expect(result.signal!.aborted).toBe(false);
    });

    it("handles missing timeout", () => {
      const result = buildTimeoutAbortSignal({});
      expect(result).toBeDefined();
    });
  });
});
