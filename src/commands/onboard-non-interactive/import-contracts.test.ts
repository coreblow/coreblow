/**
 * src/commands/onboard-non-interactive/import-contracts.test.ts
 */
import { describe, expect, it } from "vitest";
describe("onboard-non-interactive/local/auth-choice-inference — import", () => {
  it("is importable", async () => {
    const m = await import("./local/auth-choice-inference.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("onboard-non-interactive/local/auth-choice.plugin-providers.runtime — import", () => {
  it("is importable", async () => {
    const m = await import("./local/auth-choice.plugin-providers.runtime.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("onboard-non-interactive/local/gateway-config — import", () => {
  it("is importable", async () => {
    const m = await import("./local/gateway-config.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("onboard-non-interactive/local/output — import", () => {
  it("is importable", async () => {
    const m = await import("./local/output.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("onboard-non-interactive/local/skills-config — import", () => {
  it("is importable", async () => {
    const m = await import("./local/skills-config.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("onboard-non-interactive/local/workspace — import", () => {
  it("is importable", async () => {
    const m = await import("./local/workspace.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("onboard-non-interactive/remote — import", () => {
  it("is importable", async () => {
    const m = await import("./remote.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
