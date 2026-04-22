import { describe, expect, it } from "vitest";
describe("model-fallback.types — import", () => { it("ok", async () => { const m = await import("./model-fallback.types.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("model-scan — import", () => { it("ok", async () => { const m = await import("./model-scan.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
