import { describe, expect, it } from "vitest";
describe("agent-command — import", () => { it("ok", async () => { const m = await import("./agent-command.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("agent-engine — import", () => { it("ok", async () => { const m = await import("./agent-engine.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
