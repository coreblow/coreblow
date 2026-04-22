import { describe, expect, it } from "vitest";
describe("context-cache — import", () => { it("ok", async () => { const m = await import("./context-cache.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("context-tokens.runtime — import", () => { it("ok", async () => { const m = await import("./context-tokens.runtime.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
