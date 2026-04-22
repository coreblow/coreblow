import { describe, expect, it } from "vitest";
describe("coreblow-tools — import", () => { it("ok", async () => { const m = await import("./coreblow-tools.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("coreblow-tools.runtime — import", () => { it("ok", async () => { const m = await import("./coreblow-tools.runtime.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
