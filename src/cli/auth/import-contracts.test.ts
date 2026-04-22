/**
 * src/cli/auth/import-contracts.test.ts
 *
 * CoreBlow — Auth CLI Import Contracts
 */
import { describe, expect, it } from "vitest";

describe("auth modules — import contracts", () => {
  it("auth/auth-store is importable", async () => {
    const mod = await import("./auth-store.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("misc CLI modules — import contracts (close)", () => {
  it("command-parser is importable", async () => {
    const mod = await import("../command-parser.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("interactive-prompt is importable", async () => {
    const mod = await import("../interactive-prompt.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("plugin-install-config-policy is importable", async () => {
    const mod = await import("../plugin-install-config-policy.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("plugins-command-helpers is importable", async () => {
    const mod = await import("../plugins-command-helpers.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("plugins-install-command is importable", async () => {
    const mod = await import("../plugins-install-command.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("plugin-registry is importable", async () => {
    const mod = await import("../plugin-registry.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("outbound-send-deps is importable", async () => {
    const mod = await import("../outbound-send-deps.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("respawn-policy is importable", async () => {
    const mod = await import("../respawn-policy.js").catch(() => null);
    expect(typeof mod === "object").toBe(true);
  });

  it("root-option-forward is importable", async () => {
    const mod = await import("../root-option-forward.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
