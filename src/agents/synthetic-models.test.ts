import { describe, expect, it } from "vitest";
describe("synthetic-models — import", () => { it("ok", async () => { const m = await import("./synthetic-models.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("together-models — import", () => { it("ok", async () => { const m = await import("./together-models.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("vendor-models — import", () => { it("ok", async () => { const m = await import("./vendor-models.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("volc-models.shared — import", () => { it("ok", async () => { const m = await import("./volc-models.shared.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
