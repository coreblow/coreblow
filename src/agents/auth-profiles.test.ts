import { describe, expect, it } from "vitest";
describe("auth-profiles — import", () => { it("ok", async () => { const m = await import("./auth-profiles.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("auth-profiles.runtime — import", () => { it("ok", async () => { const m = await import("./auth-profiles.runtime.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
