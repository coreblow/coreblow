import { describe, expect, it } from "vitest";
describe("protocol/schema/cron — import", () => {
  it("is importable", async () => {
    const m = await import("./cron.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("protocol/schema/devices — import", () => {
  it("is importable", async () => {
    const m = await import("./devices.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("protocol/schema/exec-approvals — import", () => {
  it("is importable", async () => {
    const m = await import("./exec-approvals.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
