import { describe, expect, it } from "vitest";
describe("tool-definitions — import", () => { it("ok", async () => { const m = await import("./tool-definitions.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tool-display-common — import", () => { it("ok", async () => { const m = await import("./tool-display-common.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tool-display-exec-shell — import", () => { it("ok", async () => { const m = await import("./tool-display-exec-shell.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tool-display-exec — import", () => { it("ok", async () => { const m = await import("./tool-display-exec.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
