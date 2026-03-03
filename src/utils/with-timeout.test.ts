import { describe, expect, it } from "vitest";
import { withTimeout } from "./with-timeout.js";

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects when timeout occurs before resolution", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 5000));
    await expect(withTimeout(slow, 50)).rejects.toThrow();
  });

  it("preserves the resolved value type", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it("propagates promise rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("fail")), 1000)).rejects.toThrow("fail");
  });
});
