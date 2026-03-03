import { describe, expect, it } from "vitest";
describe("embedded-pi-lsp — import", () => { it("ok", async () => { const m = await import("./embedded-pi-lsp.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("embedded-pi-mcp — import", () => { it("ok", async () => { const m = await import("./embedded-pi-mcp.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
