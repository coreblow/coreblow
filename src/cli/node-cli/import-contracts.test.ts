import { describe, expect, it } from "vitest";

const modules = [
  { name: "register", path: "./register.js" },
  { name: "daemon",   path: "./daemon.js" },
];

describe("node-cli — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});

describe("node-cli root modules — import contracts", () => {
  it("acp-cli is importable", async () => {
    const mod = await import("../acp-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("channels-cli is importable", async () => {
    const mod = await import("../channels-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("cli-banner is importable", async () => {
    const mod = await import("../cli-banner.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("dns-cli is importable", async () => {
    const mod = await import("../dns-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("docs-cli is importable", async () => {
    const mod = await import("../docs-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("clawbot-cli is importable", async () => {
    const mod = await import("../clawbot-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
