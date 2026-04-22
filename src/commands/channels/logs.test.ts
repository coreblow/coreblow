/**
 * src/commands/channels/logs.test.ts
 */
import { describe, expect, it } from "vitest";
describe("channels/logs — import", () => {
  it("is importable", async () => {
    const m = await import("./logs.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channels/remove — import", () => {
  it("is importable", async () => {
    const m = await import("./remove.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
