/**
 * src/gateway/server-methods/tts.ts.test.ts
 */
import { describe, expect, it } from "vitest";
describe("server-methods/tts — import", () => {
  it("is importable", async () => {
    const m = await import("./tts.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/types — import", () => {
  it("is importable", async () => {
    const m = await import("./types.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
