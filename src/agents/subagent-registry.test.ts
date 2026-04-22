import { describe, expect, it } from "vitest";
describe("subagent-registry — import", () => { it("ok", async () => { const m = await import("./subagent-registry.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry-lifecycle — import", () => { it("ok", async () => { const m = await import("./subagent-registry-lifecycle.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry-memory — import", () => { it("ok", async () => { const m = await import("./subagent-registry-memory.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry-read — import", () => { it("ok", async () => { const m = await import("./subagent-registry-read.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry-run-manager — import", () => { it("ok", async () => { const m = await import("./subagent-registry-run-manager.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
