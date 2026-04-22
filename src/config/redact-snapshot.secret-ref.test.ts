import { describe, expect, it } from "vitest";

describe("redact-snapshot.secret-ref module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./redact-snapshot.secret-ref.js")).resolves.toBeDefined();
  });

  it("exports are object type", async () => {
    const mod = await import("./redact-snapshot.secret-ref.js");
    expect(typeof mod).toBe("object");
  });

  it("has at least one named export", async () => {
    const mod = await import("./redact-snapshot.secret-ref.js");
    const keys = Object.keys(mod);
    expect(keys.length).toBeGreaterThan(0);
  });
});
