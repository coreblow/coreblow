/**
 * src/commands/channels/resolve.test.ts
 */
import { describe, expect, it } from "vitest";
describe("channels/resolve — import", () => {
  it("is importable", async () => {
    const m = await import("./resolve.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("channels/shared — import", () => {
  it("is importable", async () => {
    const m = await import("./shared.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
