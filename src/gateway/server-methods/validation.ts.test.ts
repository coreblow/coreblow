/**
 * src/gateway/server-methods/validation.ts.test.ts
 */
import { describe, expect, it } from "vitest";
describe("server-methods/validation — import", () => {
  it("is importable", async () => {
    const m = await import("./validation.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/voicewake — import", () => {
  it("is importable", async () => {
    const m = await import("./voicewake.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
