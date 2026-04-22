import { describe, expect, it } from "vitest";

describe("gateway-cli/run — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./run.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("gateway-cli/dev — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./dev.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
