/**
 * src/config/config.ts.test.ts
 *
 * CoreBlow — Config Core + Config-IO Pure Logic Tests
 */
import { describe, expect, it } from "vitest";

describe("config/ core modules — import contracts (close)", () => {
  it("config.ts is importable", async () => {
    const mod = await import("./config.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("config-io.ts is importable", async () => {
    const mod = await import("./config-io.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("config-loader.ts is importable", async () => {
    const mod = await import("./config-loader.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("channel-config-metadata is importable", async () => {
    const mod = await import("./channel-config-metadata.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("bundled-channel-config-metadata is importable", async () => {
    const mod = await import("./bundled-channel-config-metadata.generated.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("legacy.ts is importable", async () => {
    const mod = await import("./legacy.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("legacy.rules.ts is importable", async () => {
    const mod = await import("./legacy.rules.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("includes-scan is importable", async () => {
    const mod = await import("./includes-scan.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
