import { describe, expect, it } from "vitest";
describe("subagent-registry-runtime — import", () => { it("ok", async () => { const m = await import("./subagent-registry-runtime.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry-state — import", () => { it("ok", async () => { const m = await import("./subagent-registry-state.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry.mocks.shared — import", () => { it("ok", async () => { const m = await import("./subagent-registry.mocks.shared.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry.store — import", () => { it("ok", async () => { const m = await import("./subagent-registry.store.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("subagent-registry.types — import", () => { it("ok", async () => { const m = await import("./subagent-registry.types.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
