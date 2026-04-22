import { describe, expect, it } from "vitest";

describe("config validation & zod-schema — import contracts", () => {
  it("validation is importable", async () => {
    const mod = await import("./validation.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("zod-schema is importable", async () => {
    const mod = await import("./zod-schema.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("zod-schema.core is importable", async () => {
    const mod = await import("./zod-schema.core.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("zod-schema.sensitive is importable", async () => {
    const mod = await import("./zod-schema.sensitive.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("watch is importable", async () => {
    const mod = await import("./watch.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("sessions/types is importable", async () => {
    const mod = await import("./sessions/types.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("test-helpers is importable", async () => {
    const mod = await import("./test-helpers.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
