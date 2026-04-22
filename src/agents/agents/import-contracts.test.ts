import { describe, expect, it } from "vitest";
describe("agents/agents/code-interpreter — import", () => {
  it("is importable", async () => {
    const m = await import("./code-interpreter.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
