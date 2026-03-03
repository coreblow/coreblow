import { describe, expect, it } from "vitest";
import { DetectBinaryService, getDetectBinaryService } from "./detect-binary.js";

describe("DetectBinaryService", () => {
  it("constructs without throwing", () => {
    expect(() => new DetectBinaryService()).not.toThrow();
  });

  it("has Symbol.toStringTag", () => {
    const svc = new DetectBinaryService();
    expect(svc[Symbol.toStringTag]).toBe("DetectBinaryService");
  });

  it("is a class (can be instantiated)", () => {
    const instance = new DetectBinaryService();
    expect(instance instanceof DetectBinaryService).toBe(true);
  });
});

describe("getDetectBinaryService()", () => {
  it("is a function", () => {
    expect(typeof getDetectBinaryService).toBe("function");
  });

  it("returns an instance of DetectBinaryService", () => {
    const svc = getDetectBinaryService();
    expect(svc instanceof DetectBinaryService).toBe(true);
  });

  it("returns same singleton on repeated calls", () => {
    const a = getDetectBinaryService();
    const b = getDetectBinaryService();
    expect(a).toBe(b);
  });
});
