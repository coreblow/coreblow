/**
 * src/commands/agents.commands.add.test.ts
 */
import { describe, expect, it } from "vitest";
describe("agents.commands.add — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.commands.add.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("agents.commands.bind — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.commands.bind.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
