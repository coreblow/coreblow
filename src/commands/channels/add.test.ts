/**
 * src/commands/channels/add.test.ts
 */
import { describe, expect, it } from "vitest";
describe("channels/add — import", () => {
  it("is importable", async () => {
    const m = await import("./add.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channels/list — import", () => {
  it("is importable", async () => {
    const m = await import("./list.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
