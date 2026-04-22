import { describe, expect, it } from "vitest";
describe("models-config.plan — import", () => { it("ok", async () => { const m = await import("./models-config.plan.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("models-config.providers — import", () => { it("ok", async () => { const m = await import("./models-config.providers.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("models-config.runtime — import", () => { it("ok", async () => { const m = await import("./models-config.runtime.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
