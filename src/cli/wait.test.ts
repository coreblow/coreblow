import { describe, expect, it } from "vitest";
import { waitForever } from "./wait.js";

describe("waitForever()", () => {
  it("is a function", () => {
    expect(typeof waitForever).toBe("function");
  });

  it("returns a Promise", () => {
    const result = waitForever();
    expect(result instanceof Promise).toBe(true);
    // Cleanup: we don't await it (it never resolves)
  });

  it("does not throw when called", () => {
    expect(() => waitForever()).not.toThrow();
  });
});
