/**
 * src/config/state-dir-dotenv.test.ts
 *
 * CoreBlow — State Directory Dotenv Tests
 * Verifies readStateDirDotEnvVars and collectDurableServiceEnvVars
 * exports are available and callable.
 */
import { describe, expect, it } from "vitest";

describe("state-dir-dotenv module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./state-dir-dotenv.js")).resolves.toBeDefined();
  });

  it("readStateDirDotEnvVars is a function", async () => {
    const mod = await import("./state-dir-dotenv.js");
    expect(typeof (mod as Record<string, unknown>).readStateDirDotEnvVars).toBe("function");
  });

  it("collectDurableServiceEnvVars is a function", async () => {
    const mod = await import("./state-dir-dotenv.js");
    expect(typeof (mod as Record<string, unknown>).collectDurableServiceEnvVars).toBe("function");
  });

  it("module exports are defined", async () => {
    const mod = await import("./state-dir-dotenv.js");
    expect(mod).toBeDefined();
  });
});
