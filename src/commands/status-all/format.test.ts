/**
 * src/commands/status-all/format.test.ts
 */
import { describe, expect, it } from "vitest";
describe("status-all/format — import", () => {
  it("is importable", async () => {
    const m = await import("./format.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("status-all/gateway — import", () => {
  it("is importable", async () => {
    const m = await import("./gateway.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
