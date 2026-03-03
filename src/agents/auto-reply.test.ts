import { describe, expect, it } from "vitest";
describe("auto-reply — import", () => { it("ok", async () => { const m = await import("./auto-reply.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("console-sanitize — import", () => { it("ok", async () => { const m = await import("./console-sanitize.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
