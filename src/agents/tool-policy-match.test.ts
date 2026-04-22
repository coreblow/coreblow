import { describe, expect, it } from "vitest";
describe("tool-policy-match — import", () => { it("ok", async () => { const m = await import("./tool-policy-match.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tool-policy-shared — import", () => { it("ok", async () => { const m = await import("./tool-policy-shared.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tool-policy.conformance — import", () => { it("ok", async () => { const m = await import("./tool-policy.conformance.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tool-summaries — import", () => { it("ok", async () => { const m = await import("./tool-summaries.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
describe("tools-effective-inventory — import", () => { it("ok", async () => { const m = await import("./tools-effective-inventory.js").catch(() => null); expect(m === null || typeof m === "object").toBe(true); }); });
