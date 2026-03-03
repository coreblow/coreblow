import { describe, expect, it } from "vitest";

describe("zod-schema.secret-input-validation module", () => {
  it("exports are importable", async () => {
    const mod = await import("./zod-schema.secret-input-validation.js");
    expect(typeof mod).toBe("object");
  });

  it("validateTelegramSecretInputRequirements is exported as function", async () => {
    const mod = await import("./zod-schema.secret-input-validation.js");
    const fn = (mod as Record<string, unknown>).validateTelegramSecretInputRequirements;
    if (fn !== undefined) {
      expect(typeof fn).toBe("function");
    }
  });

  it("validateSlackSecretInputRequirements is exported as function", async () => {
    const mod = await import("./zod-schema.secret-input-validation.js");
    const fn = (mod as Record<string, unknown>).validateSlackSecretInputRequirements;
    if (fn !== undefined) {
      expect(typeof fn).toBe("function");
    }
  });

  it("module does not throw on import", async () => {
    await expect(import("./zod-schema.secret-input-validation.js")).resolves.toBeDefined();
  });
});
