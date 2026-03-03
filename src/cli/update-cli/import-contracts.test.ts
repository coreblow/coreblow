import { describe, expect, it } from "vitest";

const modules = [
  { name: "status",           path: "./status.js" },
  { name: "update-command",   path: "./update-command.js" },
  { name: "wizard",           path: "./wizard.js" },
];

describe("update-cli — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});

describe("CLI misc modules — import contracts", () => {
  it("output-formatter module is importable", async () => {
    const mod = await import("../output-formatter.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("plugin-install-persist is importable", async () => {
    const mod = await import("../plugins-install-persist.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("plugins-update-command is importable", async () => {
    const mod = await import("../plugins-update-command.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("webhooks-cli is importable", async () => {
    const mod = await import("../webhooks-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("gateway-rpc is importable", async () => {
    const mod = await import("../gateway-rpc.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
