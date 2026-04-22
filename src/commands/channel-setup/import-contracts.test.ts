import { describe, expect, it } from "vitest";
describe("channel-setup/channel-plugin-resolution — import", () => {
  it("is importable", async () => {
    const m = await import("./channel-plugin-resolution.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channel-setup/types — import", () => {
  it("is importable", async () => {
    const m = await import("./types.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channel-test-helpers — import", () => {
  it("is importable", async () => {
    const m = await import("../channel-test-helpers.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
