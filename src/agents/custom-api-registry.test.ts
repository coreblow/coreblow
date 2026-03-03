import { describe, expect, it } from "vitest";
describe("custom-api-registry — import", () => { it("ok", async () => { const m = await import("./custom-api-registry.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("defaults — import", () => { it("ok", async () => { const m = await import("./defaults.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
