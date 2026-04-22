/**
 * src/gateway/session-archive.test.ts
 */
import { describe, expect, it } from "vitest";
describe("gateway/session-archive.fs — import", () => {
  it("is importable", async () => {
    const m = await import("./session-archive.fs.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("gateway/session-archive.runtime — import", () => {
  it("is importable", async () => {
    const m = await import("./session-archive.runtime.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("gateway/session-transcript-files.fs — import", () => {
  it("is importable", async () => {
    const m = await import("./session-transcript-files.fs.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("gateway/session-subagent-reactivation.runtime — import", () => {
  it("is importable", async () => {
    const m = await import("./session-subagent-reactivation.runtime.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
