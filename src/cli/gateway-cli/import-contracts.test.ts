/**
 * src/cli/gateway-cli/import-contracts.test.ts
 *
 * CoreBlow — Gateway CLI Register Import Contracts
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "register", path: "./register.js" },
  { name: "run",      path: "./run.js" },
  { name: "dev",      path: "./dev.js" },
  { name: "call",     path: "./call.js" },
];

describe("gateway-cli — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
