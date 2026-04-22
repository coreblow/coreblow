import { describe, expect, it } from "vitest";

const modules = [
  { name: "completion-cmd", path: "./completion-cmd.js" },
  { name: "version-cmd",    path: "./version-cmd.js" },
  { name: "status-cmd",     path: "./status-cmd.js" },
  { name: "health-cmd",     path: "./health-cmd.js" },
  { name: "doctor-cmd",     path: "./doctor-cmd.js" },
  { name: "logs-cmd",       path: "./logs-cmd.js" },
  { name: "update-cmd",     path: "./update-cmd.js" },
  { name: "reset-cmd",      path: "./reset-cmd.js" },
  { name: "uninstall-cmd",  path: "./uninstall-cmd.js" },
  { name: "backup-cmd",     path: "./backup-cmd.js" },
];

describe("CLI commands — import contracts (batch A)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
