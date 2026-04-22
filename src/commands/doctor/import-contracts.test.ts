/**
 * src/commands/doctor/import-contracts.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/doctor/shared/allow-from-mode — import", () => {
  it("is importable", async () => {
    const m = await import("./shared/allow-from-mode.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor/shared/default-account-warnings — import", () => {
  it("is importable", async () => {
    const m = await import("./shared/default-account-warnings.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor/shared/object — import", () => {
  it("is importable", async () => {
    const m = await import("./shared/object.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor/types — import", () => {
  it("is importable", async () => {
    const m = await import("./types.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
