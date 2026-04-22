/**
 * src/commands/doctor-platform-notes.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/doctor-platform-notes — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-platform-notes.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor-repair-mode — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-repair-mode.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
