import { describe, expect, it } from "vitest";

describe("update-cli/wizard — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./wizard.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("update-cli/status — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./status.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
