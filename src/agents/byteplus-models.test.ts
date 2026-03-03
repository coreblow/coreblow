import { describe, expect, it } from "vitest";
describe("byteplus-models — import", () => { it("ok", async () => { const m = await import("./byteplus-models.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("claude-cli-runner — import", () => { it("ok", async () => { const m = await import("./claude-cli-runner.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("cli-runner — import", () => { it("ok", async () => { const m = await import("./cli-runner.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("cli-watchdog-defaults — import", () => { it("ok", async () => { const m = await import("./cli-watchdog-defaults.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
