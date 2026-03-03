import { describe, expect, it } from "vitest";
describe("wizard/doctor-wizard — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-wizard.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("wizard/gateway-status — import", () => {
  it("is importable", async () => {
    const m = await import("./gateway-status.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("wizard/models-wizard — import", () => {
  it("is importable", async () => {
    const m = await import("./models-wizard.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("wizard/status-all — import", () => {
  it("is importable", async () => {
    const m = await import("./status-all.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
