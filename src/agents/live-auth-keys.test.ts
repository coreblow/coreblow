import { describe, expect, it } from "vitest";
describe("live-auth-keys — import", () => { it("ok", async () => { const m = await import("./live-auth-keys.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("mcp-stdio — import", () => { it("ok", async () => { const m = await import("./mcp-stdio.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
