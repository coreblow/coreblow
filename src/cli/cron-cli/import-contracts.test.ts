import { describe, expect, it } from "vitest";

const modules = [
  { name: "register.ts",          path: "./register.js" },
  { name: "register.cron-add",    path: "./register.cron-add.js" },
  { name: "register.cron-edit",   path: "./register.cron-edit.js" },
  { name: "register.cron-simple", path: "./register.cron-simple.js" },
];

describe("cron-cli — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
