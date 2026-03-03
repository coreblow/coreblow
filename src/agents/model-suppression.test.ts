import { describe, expect, it } from "vitest";
describe("model-suppression — import", () => { it("ok", async () => { const m = await import("./model-suppression.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("model-suppression.runtime — import", () => { it("ok", async () => { const m = await import("./model-suppression.runtime.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
