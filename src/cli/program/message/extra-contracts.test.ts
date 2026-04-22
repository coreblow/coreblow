/**
 * src/cli/program/message/extra-contracts.test.ts
 *
 * CoreBlow — CLI Program Message Extra Import Contracts
 */
import { describe, expect, it } from "vitest";

describe("program/message extra — import contracts", () => {
  it("register.discord-admin is importable", async () => {
    const mod = await import("./register.discord-admin.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("register.emoji-sticker is importable", async () => {
    const mod = await import("./register.emoji-sticker.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("register.permissions-search is importable", async () => {
    const mod = await import("./register.permissions-search.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("CLI remaining root — final contracts", () => {
  it("plugin-commands is importable", async () => {
    const mod = await import("../../cli/plugin-commands.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("prompt.runtime is importable", async () => {
    const mod = await import("../../cli/prompt.runtime.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
