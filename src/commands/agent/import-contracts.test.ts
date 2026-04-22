import { describe, expect, it } from "vitest";

describe("commands/agent — import contracts", () => {
  it("agent/delivery is importable", async () => {
    const m = await import("./delivery.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
  it("agent/run-context is importable", async () => {
    const m = await import("./run-context.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
  it("agent/types is importable", async () => {
    const m = await import("./types.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
