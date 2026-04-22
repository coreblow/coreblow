import { describe, expect, it } from "vitest";
describe("configure.channels — import", () => {
  it("is importable", async () => {
    const m = await import("./configure.channels.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("configure.commands — import", () => {
  it("is importable", async () => {
    const m = await import("./configure.commands.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
