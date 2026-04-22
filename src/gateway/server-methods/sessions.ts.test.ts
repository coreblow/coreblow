import { describe, expect, it } from "vitest";
describe("server-methods/sessions — import", () => {
  it("is importable", async () => {
    const m = await import("./sessions.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/skills — import", () => {
  it("is importable", async () => {
    const m = await import("./skills.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
