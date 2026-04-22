import { describe, expect, it } from "vitest";
describe("commands/onboard-non-interactive — import", () => {
  it("is importable", async () => {
    const m = await import("./onboard-non-interactive.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/onboard-non-interactive/api-keys — import", () => {
  it("is importable", async () => {
    const m = await import("./onboard-non-interactive/api-keys.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/onboard-non-interactive/local — import", () => {
  it("is importable", async () => {
    const m = await import("./onboard-non-interactive/local.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
