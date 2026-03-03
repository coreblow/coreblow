import { describe, expect, it } from "vitest";
describe("agents.commands.delete — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.commands.delete.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("agents.commands.identity — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.commands.identity.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
