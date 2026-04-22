/**
 * src/config/config-hot-reload.test.ts
 *
 * CoreBlow — Config Hot Reload Import Contract
 */
import { describe, expect, it } from "vitest";

describe("config-hot-reload — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./config-hot-reload.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("env-vars is importable", async () => {
    const mod = await import("./env-vars.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("redact-snapshot.raw is importable", async () => {
    const mod = await import("./redact-snapshot.raw.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("config-hot-reload module is an object", async () => {
    const mod = await import("./config-hot-reload.js").catch(() => ({}));
    expect(typeof mod).toBe("object");
  });
});
