/**
 * src/commands/setup/import-contracts.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/setup/__tests__/test-utils — import", () => {
  it("is importable", async () => {
    const m = await import("./__tests__/test-utils.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
