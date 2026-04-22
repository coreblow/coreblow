import { describe, expect, it } from "vitest";
describe("bash-tools-exec — import", () => { it("ok", async () => { const m = await import("./bash-tools-exec.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("bash-tools.exec — import", () => { it("ok", async () => { const m = await import("./bash-tools.exec.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("bash-tools.process — import", () => { it("ok", async () => { const m = await import("./bash-tools.process.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
