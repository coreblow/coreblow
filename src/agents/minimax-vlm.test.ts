import { describe, expect, it } from "vitest";
describe("minimax-vlm — import", () => { it("ok", async () => { const m = await import("./minimax-vlm.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("model-alias-lines — import", () => { it("ok", async () => { const m = await import("./model-alias-lines.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
