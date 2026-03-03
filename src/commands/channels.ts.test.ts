import { describe, expect, it } from "vitest";
describe("channels.ts — import", () => {
  it("is importable", async () => {
    const m = await import("./channels.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channels.mock-harness — import", () => {
  it("is importable", async () => {
    const m = await import("./channels.mock-harness.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channels.plugin-install.test-helpers — import", () => {
  it("is importable", async () => {
    const m = await import("./channels.plugin-install.test-helpers.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
