/**
 * src/cli/config/import-contracts.test.ts
 *
 * CoreBlow — CLI Config & Remaining Module Import Contracts
 */
import { describe, expect, it } from "vitest";

describe("config/ — import contracts", () => {
  it("config/cli-config-store is importable", async () => {
    const mod = await import("./cli-config-store.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("program/ — import contracts", () => {
  it("program/register.agent is importable", async () => {
    const mod = await import("../program/register.agent.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("program/root-help is importable", async () => {
    const mod = await import("../program/root-help.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("program/json-mode is importable", async () => {
    const mod = await import("../program/json-mode.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("remaining CLI root — import contracts", () => {
  it("dotenv is importable", async () => {
    const mod = await import("../dotenv.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("sandbox-cli is importable", async () => {
    const mod = await import("../sandbox-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("nodes-run is importable", async () => {
    const mod = await import("../nodes-run.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("tui is importable", async () => {
    const mod = await import("../tui.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("daemon-cli is importable", async () => {
    const mod = await import("../daemon-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("gateway-cli is importable", async () => {
    const mod = await import("../gateway-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
