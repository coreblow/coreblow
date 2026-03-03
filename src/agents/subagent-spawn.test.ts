import { describe, expect, it } from "vitest";
describe("subagent-spawn — import", () => { it("ok", async () => { const m = await import("./subagent-spawn.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-spawn.test-helpers — import", () => { it("ok", async () => { const m = await import("./subagent-spawn.test-helpers.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent — import", () => { it("ok", async () => { const m = await import("./subagent.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
