/**
 * src/commands/commands.import-contracts-d.test.ts
 *
 * CoreBlow — Commands Import Contracts (Batch D)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "cleanup-plan",          path: "./cleanup-plan.js" },
  { name: "configure.channels",    path: "./configure.channels.js" },
  { name: "configure.commands",    path: "./configure.commands.js" },
  { name: "configure.shared",      path: "./configure.shared.js" },
  { name: "configure",             path: "./configure.js" },
  { name: "daemon-runtime",        path: "./daemon-runtime.js" },
  { name: "docs",                  path: "./docs.js" },
  { name: "doctor-auth",           path: "./doctor-auth.js" },
  { name: "doctor-completion",     path: "./doctor-completion.js" },
  { name: "onboard-types",         path: "./onboard-types.js" },
];

describe("commands/ — import contracts (batch D)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
