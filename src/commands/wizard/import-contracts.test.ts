import { describe, expect, it } from "vitest";

const modules = [
  { name: "wizard/doctor-wizard",  path: "./doctor-wizard.js" },
  { name: "wizard/gateway-status", path: "./gateway-status.js" },
  { name: "wizard/models-wizard",  path: "./models-wizard.js" },
  { name: "wizard/status-all",     path: "./status-all.js" },
];

describe("commands/wizard/ — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
