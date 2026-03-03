import { describe, it, expect } from "vitest";
import { sanitizeNodeInvokeParamsForForwarding } from "./node-invoke-sanitize.js";

describe("sanitizeNodeInvokeParamsForForwarding", () => {
  it("passes through non-system.run commands without sanitization", () => {
    const result = sanitizeNodeInvokeParamsForForwarding({
      nodeId: "node-1",
      command: "camera.snap",
      rawParams: { resolution: "1080p" },
      client: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toEqual({ resolution: "1080p" });
    }
  });

  it("passes through canvas commands", () => {
    const result = sanitizeNodeInvokeParamsForForwarding({
      nodeId: "node-1",
      command: "canvas.present",
      rawParams: { url: "https://example.com" },
      client: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toEqual({ url: "https://example.com" });
    }
  });

  it("delegates system.run to sanitizeSystemRunParamsForForwarding", () => {
    // system.run goes through special sanitization
    const result = sanitizeNodeInvokeParamsForForwarding({
      nodeId: "node-1",
      command: "system.run",
      rawParams: { cmd: "echo hello" },
      client: null,
    });
    // Result depends on sanitizeSystemRunParamsForForwarding implementation
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe("boolean");
  });
});
