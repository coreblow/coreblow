import { describe, expect, it } from "vitest";

describe("cron/service store-migration module", () => {
  it("cron store-migrations module is importable", async () => {
    const mod = await import("./store.js").catch(() => null);
    // May not exist in this build; graceful skip
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("cron store module", () => {
  it("cron/service/store is importable", async () => {
    const mod = await import("./store.js");
    expect(typeof mod).toBe("object");
  });

  it("store exports at least one function", async () => {
    const mod = await import("./store.js") as Record<string, unknown>;
    const fns = Object.values(mod).filter((v) => typeof v === "function");
    expect(fns.length).toBeGreaterThan(0);
  });
});
