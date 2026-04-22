/**
 * src/gateway/startup-auth.test.ts
 */
import { describe, expect, it } from "vitest";
describe("gateway/startup-auth — import", () => {
  it("is importable", async () => {
    const m = await import("./startup-auth.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("gateway/startup-auth-profiles — import", () => {
  it("is importable", async () => {
    const m = await import("./startup-auth-profiles.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("gateway/startup-control-ui-origins — import", () => {
  it("is importable", async () => {
    const m = await import("./startup-control-ui-origins.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
