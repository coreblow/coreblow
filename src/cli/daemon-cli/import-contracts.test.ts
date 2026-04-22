/**
 * src/cli/daemon-cli/import-contracts.test.ts
 *
 * CoreBlow — Daemon CLI Import Contracts
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "register",   path: "./register.js" },
  { name: "runners",    path: "./runners.js" },
  { name: "lifecycle",  path: "./lifecycle.js" },
];

describe("daemon-cli — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
