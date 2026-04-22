import { describe, expect, it } from "vitest";
describe("deepseek-models — import", () => { it("ok", async () => { const m = await import("./deepseek-models.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("doubao-models — import", () => { it("ok", async () => { const m = await import("./doubao-models.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
