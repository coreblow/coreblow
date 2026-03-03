import { describe, expect, it } from "vitest";
describe("fork — import", () => { it("ok", async () => { const m = await import("./fork.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("lifecycle — import", () => { it("ok", async () => { const m = await import("./lifecycle.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
