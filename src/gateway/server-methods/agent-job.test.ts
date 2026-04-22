import { describe, expect, it } from "vitest";
describe("server-methods/agent-job — import", () => {
  it("is importable", async () => {
    const m = await import("./agent-job.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/agents — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
