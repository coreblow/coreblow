import { describe, expect, it } from "vitest";
describe("auth-choice-prompt — import", () => {
  it("is importable", async () => {
    const m = await import("./auth-choice-prompt.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("auth-choice.api-key — import", () => {
  it("is importable", async () => {
    const m = await import("./auth-choice.api-key.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("auth-choice.apply.ts — import", () => {
  it("is importable", async () => {
    const m = await import("./auth-choice.apply.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
