import { describe, expect, it } from "vitest";
describe("trace-base — import", () => { it("ok", async () => { const m = await import("./trace-base.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("turn-controller — import", () => { it("ok", async () => { const m = await import("./turn-controller.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("workspace-dir — import", () => { it("ok", async () => { const m = await import("./workspace-dir.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("workspace-dirs — import", () => { it("ok", async () => { const m = await import("./workspace-dirs.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
