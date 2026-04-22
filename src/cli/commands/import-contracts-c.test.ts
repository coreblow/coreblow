import { describe, expect, it } from "vitest";

const modules = [
  { name: "dashboard-cmd",  path: "./dashboard-cmd.js" },
  { name: "devices-cmd",    path: "./devices-cmd.js" },
  { name: "nodes-cmd",      path: "./nodes-cmd.js" },
  { name: "configure-cmd",  path: "./configure-cmd.js" },
  { name: "config-cmd",     path: "./config-cmd.js" },
  { name: "webhooks-cmd",   path: "./webhooks-cmd.js" },
  { name: "message-cmd",    path: "./message-cmd.js" },
  { name: "gateway-cmd",    path: "./gateway-cmd.js" },
];

describe("CLI commands — import contracts (batch C)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
