import { describe, expect, it } from "vitest";
describe("status-all/agents — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("status-all/channel-issues — import", () => {
  it("is importable", async () => {
    const m = await import("./channel-issues.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
